/**
 * WorkflowExecutor
 * Phase 62-03: Engagement Workflow Engine
 *
 * Executes workflow steps: wait, email, task, condition, webhook, alert.
 * Handles template interpolation and anti-annoyance checks.
 */
import type { Queue } from "bullmq";
import type { WorkflowRepository } from "../repositories/WorkflowRepository";
import type { EngagementService, WorkflowJobData } from "./EngagementService";
import type {
  WorkflowInstanceSelect,
  WorkflowStep,
  WaitConfig,
  EmailConfig,
  TaskConfig,
  ConditionConfig,
  WebhookConfig,
  AlertConfig,
} from "@/db";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "WorkflowExecutor" });

// Step execution result types
export interface StepResult {
  type: "wait" | "email" | "task" | "condition" | "webhook" | "alert" | "completed" | "skipped" | "rescheduled";
  scheduled?: boolean;
  messageId?: string;
  conditionResult?: boolean;
  reason?: string;
  error?: string;
}

// Service interfaces for dependency injection
export interface FollowUpServiceLike {
  create(
    workspaceId: string,
    userId: string,
    data: {
      entityType: string;
      entityId: string;
      followUpType: string;
      title: string;
      description?: string;
      scheduledAt: Date;
      priority: string;
    }
  ): Promise<{ id: string }>;
}

export interface EmailServiceLike {
  sendEmail(options: {
    workspaceId: string;
    to: string;
    templateId: string;
    variables: Record<string, string>;
  }): Promise<{ success: boolean; messageId?: string }>;
}

export interface AlertServiceLike {
  create(data: {
    workspaceId: string;
    alertType: string;
    severity: string;
    title: string;
    description: string;
    entityType?: string;
    entityId?: string;
  }): Promise<{ id: string }>;
  notifyUsers?(alertId: string, userIds: string[]): Promise<void>;
}

/**
 * Executes workflow steps with template interpolation and anti-annoyance checks.
 */
export class WorkflowExecutor {
  constructor(
    private readonly workflowRepo: WorkflowRepository,
    private readonly engagementService: EngagementService,
    private readonly followUpService: FollowUpServiceLike,
    private readonly emailService: EmailServiceLike,
    private readonly alertService: AlertServiceLike,
    private readonly queue: Queue<WorkflowJobData>
  ) {}

  /**
   * Execute the current step of a workflow instance.
   *
   * @param instanceId - Workflow instance ID
   * @returns Step execution result
   */
  async executeStep(instanceId: string): Promise<StepResult> {
    const instance = await this.workflowRepo.findById(instanceId);
    if (!instance || instance.status !== "active") {
      return { type: "skipped", reason: "instance_not_active" };
    }

    const template = await this.workflowRepo.getTemplateById(instance.templateId);
    if (!template) {
      return { type: "skipped", reason: "template_not_found" };
    }

    const steps = template.steps as WorkflowStep[];
    const currentStep = steps[instance.currentStep];

    if (!currentStep) {
      // All steps completed
      await this.engagementService.completeWorkflow(instanceId, "completed");
      return { type: "completed" };
    }

    // Check anti-annoyance before touch steps
    if (["email", "task", "alert"].includes(currentStep.type)) {
      const canTouch = await this.engagementService.canExecuteTouch(instance);
      if (!canTouch) {
        // Reschedule for after cooldown
        const delayMs = template.cooldownHours * 60 * 60 * 1000;
        await this.engagementService.scheduleStepWithDelay(instanceId, delayMs);
        return { type: "rescheduled", reason: "anti_annoyance" };
      }
    }

    // Execute step by type
    const result = await this.executeStepByType(currentStep, instance, template);

    // Log event
    await this.workflowRepo.logEvent(instanceId, "step_executed", {
      stepIndex: instance.currentStep,
      actionTaken: currentStep.type,
      result: result as unknown as Record<string, unknown>,
    });

    return result;
  }

  /**
   * Execute step based on type.
   */
  private async executeStepByType(
    step: WorkflowStep,
    instance: WorkflowInstanceSelect,
    template: { cooldownHours: number }
  ): Promise<StepResult> {
    switch (step.type) {
      case "wait":
        return this.executeWaitStep(step.config as WaitConfig, instance.id);

      case "email":
        return this.executeEmailStep(
          step.config as EmailConfig,
          instance
        );

      case "task":
        return this.executeTaskStep(step.config as TaskConfig, instance);

      case "condition":
        return this.executeConditionStep(
          step.config as ConditionConfig,
          instance
        );

      case "webhook":
        return this.executeWebhookStep(step.config as WebhookConfig, instance);

      case "alert":
        return this.executeAlertStep(step.config as AlertConfig, instance);

      default:
        log.warn("Unknown step type", { type: step.type, instanceId: instance.id });
        await this.engagementService.advanceStep(instance.id);
        return { type: "skipped", reason: "unknown_step_type" };
    }
  }

  /**
   * Execute wait step - schedule next step after delay.
   */
  private async executeWaitStep(
    config: WaitConfig,
    instanceId: string
  ): Promise<StepResult> {
    let delayMs = this.calculateDelayMs(config.duration);

    // Skip weekends if configured (simplified - adds 2 days if landing on weekend)
    if (config.skipWeekends) {
      const targetDate = new Date(Date.now() + delayMs);
      const dayOfWeek = targetDate.getDay();
      if (dayOfWeek === 0) delayMs += 24 * 60 * 60 * 1000; // Sunday -> Monday
      if (dayOfWeek === 6) delayMs += 2 * 24 * 60 * 60 * 1000; // Saturday -> Monday
    }

    await this.engagementService.scheduleStepWithDelay(instanceId, delayMs);

    // Advance step counter (but don't schedule immediate execution)
    await this.workflowRepo.update(instanceId, {
      currentStep: (await this.workflowRepo.findById(instanceId))!.currentStep + 1,
    });

    return { type: "wait", scheduled: true };
  }

  /**
   * Execute email step - send email and advance.
   */
  private async executeEmailStep(
    config: EmailConfig,
    instance: WorkflowInstanceSelect
  ): Promise<StepResult> {
    const context = instance.context as Record<string, unknown>;

    // Interpolate subject and body
    const subject = this.interpolateTemplate(config.subject, context);
    const body = this.interpolateTemplate(config.bodyTemplate, context);

    // Get recipient email from context
    const recipientEmail = this.getNestedValue(context, "client.email") as string ||
      this.getNestedValue(context, "prospect.email") as string ||
      "";

    if (!recipientEmail) {
      log.warn("No recipient email found", { instanceId: instance.id });
      await this.engagementService.advanceStep(instance.id);
      return { type: "email", error: "no_recipient" };
    }

    try {
      const result = await this.emailService.sendEmail({
        workspaceId: instance.workspaceId,
        to: recipientEmail,
        templateId: config.templateId,
        variables: {
          subject,
          body,
          ...this.flattenContext(context),
        },
      });

      // Increment touch count
      await this.engagementService.incrementTouchCount(instance.id);

      // Advance to next step
      await this.engagementService.advanceStep(instance.id);

      return { type: "email", messageId: result.messageId };
    } catch (error) {
      log.error("Email step failed", error instanceof Error ? error : new Error(String(error)));
      await this.engagementService.advanceStep(instance.id);
      return { type: "email", error: String(error) };
    }
  }

  /**
   * Execute task step - create follow-up.
   */
  private async executeTaskStep(
    config: TaskConfig,
    instance: WorkflowInstanceSelect
  ): Promise<StepResult> {
    const context = instance.context as Record<string, unknown>;

    // Interpolate title and description
    const title = this.interpolateTemplate(config.title, context);
    const description = config.description
      ? this.interpolateTemplate(config.description, context)
      : undefined;

    // Calculate due date
    const dueAt = new Date(
      Date.now() + this.calculateDelayMs(config.dueIn)
    );

    try {
      await this.followUpService.create(instance.workspaceId, "system", {
        entityType: instance.entityType,
        entityId: instance.entityId,
        followUpType: "reminder",
        title,
        description,
        scheduledAt: dueAt,
        priority: config.priority,
      });

      // Increment touch count (tasks are touches)
      await this.engagementService.incrementTouchCount(instance.id);

      // Advance to next step
      await this.engagementService.advanceStep(instance.id);

      return { type: "task" };
    } catch (error) {
      log.error("Task step failed", error instanceof Error ? error : new Error(String(error)));
      await this.engagementService.advanceStep(instance.id);
      return { type: "task", error: String(error) };
    }
  }

  /**
   * Execute condition step - evaluate and navigate.
   */
  private async executeConditionStep(
    config: ConditionConfig,
    instance: WorkflowInstanceSelect
  ): Promise<StepResult> {
    const context = instance.context as Record<string, unknown>;

    // Get field value from context
    const fieldValue = this.getNestedValue(context, config.field);

    // Evaluate condition
    const conditionMet = this.evaluateCondition(
      fieldValue,
      config.operator,
      config.value
    );

    const action = conditionMet ? config.onTrue : config.onFalse;

    if (action === "complete") {
      await this.engagementService.completeWorkflow(instance.id, "completed");
      return { type: "condition", conditionResult: conditionMet };
    }

    if (action === "skip") {
      // Skip to next step + 1
      const currentStep = instance.currentStep;
      await this.workflowRepo.update(instance.id, {
        currentStep: currentStep + 2,
      });
      return { type: "condition", conditionResult: conditionMet };
    }

    if (typeof action === "object" && "goto" in action) {
      // Jump to specific step
      await this.workflowRepo.update(instance.id, {
        currentStep: action.goto,
      });
      // Schedule execution of the target step
      await this.queue.add(
        "execute-step",
        { type: "execute_step", instanceId: instance.id },
        { jobId: `step-${instance.id}-${action.goto}` }
      );
      return { type: "condition", conditionResult: conditionMet };
    }

    // Default: continue to next step
    await this.engagementService.advanceStep(instance.id);
    return { type: "condition", conditionResult: conditionMet };
  }

  /**
   * Execute webhook step - POST to external URL.
   */
  private async executeWebhookStep(
    config: WebhookConfig,
    instance: WorkflowInstanceSelect
  ): Promise<StepResult> {
    const context = instance.context as Record<string, unknown>;

    // Validate URL against allowlist (threat mitigation T-62-03-01)
    // For now, we allow all URLs but log them
    log.info("Executing webhook", { url: config.url, instanceId: instance.id });

    try {
      // Interpolate body template
      const body = this.interpolateTemplate(config.bodyTemplate, context);

      const response = await fetch(config.url, {
        method: config.method,
        headers: {
          "Content-Type": "application/json",
          ...config.headers,
        },
        body,
      });

      if (!response.ok) {
        log.warn("Webhook returned error", {
          url: config.url,
          status: response.status,
        });
      }

      await this.engagementService.advanceStep(instance.id);
      return { type: "webhook" };
    } catch (error) {
      log.error("Webhook step failed", error instanceof Error ? error : new Error(String(error)));
      await this.engagementService.advanceStep(instance.id);
      return { type: "webhook", error: String(error) };
    }
  }

  /**
   * Execute alert step - create smart alert and notify.
   */
  private async executeAlertStep(
    config: AlertConfig,
    instance: WorkflowInstanceSelect
  ): Promise<StepResult> {
    const context = instance.context as Record<string, unknown>;

    // Interpolate title and message
    const title = this.interpolateTemplate(config.title, context);
    const message = this.interpolateTemplate(config.message, context);

    try {
      const alert = await this.alertService.create({
        workspaceId: instance.workspaceId,
        alertType: "workflow_alert",
        severity: config.severity,
        title,
        description: message,
        entityType: instance.entityType,
        entityId: instance.entityId,
      });

      // Notify users if the service supports it
      if (this.alertService.notifyUsers && config.notifyUsers.length > 0) {
        await this.alertService.notifyUsers(alert.id, config.notifyUsers);
      }

      // Increment touch count
      await this.engagementService.incrementTouchCount(instance.id);

      // Advance to next step
      await this.engagementService.advanceStep(instance.id);

      return { type: "alert" };
    } catch (error) {
      log.error("Alert step failed", error instanceof Error ? error : new Error(String(error)));
      await this.engagementService.advanceStep(instance.id);
      return { type: "alert", error: String(error) };
    }
  }

  /**
   * Interpolate template variables: {{client.name}}, {{invoice.number}}, etc.
   *
   * @param template - Template string with {{variable}} placeholders
   * @param context - Context object with values
   * @returns Interpolated string
   */
  interpolateTemplate(
    template: string,
    context: Record<string, unknown>
  ): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.getNestedValue(context, path.trim());
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Get nested value from object using dot notation.
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce((current: unknown, key) => {
      if (current && typeof current === "object" && key in current) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  /**
   * Calculate delay in milliseconds from duration config.
   */
  private calculateDelayMs(duration: { value: number; unit: string }): number {
    const multipliers: Record<string, number> = {
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
      weeks: 7 * 24 * 60 * 60 * 1000,
    };
    return duration.value * (multipliers[duration.unit] || multipliers.hours);
  }

  /**
   * Evaluate a condition against a value.
   */
  private evaluateCondition(
    fieldValue: unknown,
    operator: string,
    targetValue: unknown
  ): boolean {
    switch (operator) {
      case "equals":
        return fieldValue === targetValue;
      case "not_equals":
        return fieldValue !== targetValue;
      case "greater_than":
        return Number(fieldValue) > Number(targetValue);
      case "less_than":
        return Number(fieldValue) < Number(targetValue);
      case "contains":
        return String(fieldValue).includes(String(targetValue));
      default:
        return false;
    }
  }

  /**
   * Flatten context object for email variables.
   */
  private flattenContext(
    obj: Record<string, unknown>,
    prefix = ""
  ): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === "object" && !Array.isArray(value)) {
        Object.assign(
          result,
          this.flattenContext(value as Record<string, unknown>, newKey)
        );
      } else {
        result[newKey] = String(value ?? "");
      }
    }

    return result;
  }
}

// Singleton instance
let workflowExecutorInstance: WorkflowExecutor | null = null;

/**
 * Get the singleton WorkflowExecutor instance.
 */
export function getWorkflowExecutor(
  workflowRepo?: WorkflowRepository,
  engagementService?: EngagementService,
  followUpService?: FollowUpServiceLike,
  emailService?: EmailServiceLike,
  alertService?: AlertServiceLike,
  queue?: Queue<WorkflowJobData>
): WorkflowExecutor {
  if (!workflowExecutorInstance) {
    if (!workflowRepo || !engagementService || !followUpService || !emailService || !alertService || !queue) {
      throw new Error("All dependencies required for first WorkflowExecutor initialization");
    }
    workflowExecutorInstance = new WorkflowExecutor(
      workflowRepo,
      engagementService,
      followUpService,
      emailService,
      alertService,
      queue
    );
  }
  return workflowExecutorInstance;
}
