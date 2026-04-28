import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Bot, Compass, Lightbulb, Sparkles } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";

const DISCORD_URL = "https://discord.gg/c9uGs3cFXr";
const SUPPORT_EMAIL = "ben@everyapp.com";
const DATAFORSEO_MCP_DOCS_URL =
  "https://dataforseo.com/help-center/setting-up-the-official-dataforseo-mcp-server-simple-guide";

export const Route = createFileRoute("/_project/p/$projectId/ai")({
  component: AiPage,
});

function AiPage() {
  return (
    <div className="px-4 py-4 md:px-6 md:py-6 pb-24 md:pb-8 overflow-auto">
      <div className="mx-auto max-w-5xl space-y-4">
        <Card>
          <CardContent className="gap-3 flex flex-col pt-6">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="size-5" />
              <span className="text-sm font-semibold uppercase tracking-wide">
                Coming Soon
              </span>
            </div>
            <h1 className="text-2xl font-semibold">
              AI-powered features are coming soon
            </h1>
            <p className="text-sm text-foreground/70 max-w-3xl">
              We want this to be community driven. If there&apos;s a workflow
              you want solved first, let me know!
            </p>
            <div className="text-sm text-foreground/80">
              Message us on{" "}
              <a
                className="text-primary hover:underline underline-offset-4"
                href={DISCORD_URL}
                target="_blank"
                rel="noreferrer"
              >
                Discord
              </a>{" "}
              or email me at{" "}
              <a
                className="text-primary hover:underline underline-offset-4"
                href={`mailto:${SUPPORT_EMAIL}`}
              >
                {SUPPORT_EMAIL}
              </a>
              .
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="gap-3 flex flex-col pt-6">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h2 className="text-base font-semibold">
                  Planned: Content Assistant
                </h2>
              </div>
              <p className="text-sm text-foreground/70">
                Generate blog post drafts using your saved keywords, business
                context, and general strategy.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="gap-3 flex flex-col pt-6">
              <div className="flex items-center gap-2">
                <Bot className="size-4 text-primary" />
                <h2 className="text-base font-semibold">
                  Planned: SEO Research Agent
                </h2>
              </div>
              <p className="text-sm text-foreground/70">
                Ask SEO questions, run focused research, and get help using the
                app without leaving your workflow.
              </p>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardContent className="gap-3 flex flex-col pt-6">
              <div className="flex items-center gap-2">
                <Lightbulb className="size-4 text-primary" />
                <h2 className="text-base font-semibold">
                  Content Assistant workflow today
                </h2>
              </div>
              <p className="text-sm text-foreground/70">
                If you want content generation right now, make a local folder
                and use Claude Code, Claude/Cowork, Cursor, Codex, or a similar
                coding agent. Paste in your keywords, business plan, and
                strategy, then iterate with the agent until the draft is right.
              </p>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardContent className="gap-3 flex flex-col pt-6">
              <div className="flex items-center gap-2">
                <Compass className="size-4 text-primary" />
                <h2 className="text-base font-semibold">
                  DataForSEO MCP for agentic workflows
                </h2>
              </div>
              <p className="text-sm text-foreground/70">
                If you want the best agentic path for DataForSEO API data, use
                the official DataForSEO MCP server setup guide.
              </p>
              <div>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={DATAFORSEO_MCP_DOCS_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open DataForSEO MCP docs
                    <ArrowUpRight className="size-3.5" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
