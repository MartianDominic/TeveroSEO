"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Users,
  TrendingUp,
  Search,
  AlertTriangle,
  Trophy,
} from "lucide-react";
import { DraggableCard } from "./DraggableCard";
import type { PortfolioSummary } from "@/lib/dashboard/types";
import { saveCardLayout } from "@/app/(shell)/dashboard/actions";

interface QuickStatsCardsProps {
  summary: PortfolioSummary;
  initialLayout?: string[];
}

interface StatCard {
  id: string;
  title: string;
  icon: React.ReactNode;
  value: number | string;
  subtitle?: string;
}

const DEFAULT_CARD_ORDER = [
  "total-clients",
  "traffic-change",
  "keywords-top-10",
  "open-alerts",
  "wins-this-week",
  "keywords-position-1",
];

export function QuickStatsCards({ summary, initialLayout }: QuickStatsCardsProps) {
  const [cardOrder, setCardOrder] = useState<string[]>(
    initialLayout ?? DEFAULT_CARD_ORDER
  );

  // Configure sensors for mouse, touch, and keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // All available stat cards
  const allCards: StatCard[] = [
    {
      id: "total-clients",
      title: "Total Clients",
      icon: <Users className="h-4 w-4 text-muted-foreground" />,
      value: summary.totalClients,
      subtitle: `${summary.clientsNeedingAttention} need attention`,
    },
    {
      id: "traffic-change",
      title: "Avg Traffic Change",
      icon: <TrendingUp className="h-4 w-4 text-emerald-500" />,
      value: `${summary.avgTrafficChange >= 0 ? "+" : ""}${(summary.avgTrafficChange * 100).toFixed(1)}%`,
      subtitle: `${summary.totalClicks30d.toLocaleString()} clicks (30d)`,
    },
    {
      id: "keywords-top-10",
      title: "Keywords in Top 10",
      icon: <Search className="h-4 w-4 text-blue-500" />,
      value: summary.keywordsTop10,
      subtitle: `${((summary.keywordsTop10 / summary.keywordsTotal) * 100 || 0).toFixed(0)}% of total`,
    },
    {
      id: "open-alerts",
      title: "Open Alerts",
      icon: <AlertTriangle className="h-4 w-4 text-orange-500" />,
      value: summary.clientsNeedingAttention,
      subtitle: "Requires action",
    },
    {
      id: "wins-this-week",
      title: "Wins This Week",
      icon: <Trophy className="h-4 w-4 text-yellow-500" />,
      value: summary.winsThisWeek,
      subtitle: "Milestones achieved",
    },
    {
      id: "keywords-position-1",
      title: "#1 Positions",
      icon: <Trophy className="h-4 w-4 text-emerald-500" />,
      value: summary.keywordsPosition1,
      subtitle: "Across all clients",
    },
  ];

  // Get cards in current order
  const orderedCards = cardOrder
    .map((id) => allCards.find((c) => c.id === id))
    .filter((c): c is StatCard => c !== undefined);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = cardOrder.indexOf(String(active.id));
    const newIndex = cardOrder.indexOf(String(over.id));
    const newOrder = arrayMove(cardOrder, oldIndex, newIndex);

    setCardOrder(newOrder);

    // Persist to database
    try {
      await saveCardLayout(newOrder);
    } catch (error) {
      console.error("Failed to save card layout:", error);
      // Revert on error
      setCardOrder(cardOrder);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={cardOrder} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {orderedCards.map((card) => (
            <DraggableCard key={card.id} id={card.id} title={card.title} icon={card.icon}>
              <div className="text-2xl font-bold">{card.value}</div>
              {card.subtitle && (
                <p className="text-xs text-muted-foreground">{card.subtitle}</p>
              )}
            </DraggableCard>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
