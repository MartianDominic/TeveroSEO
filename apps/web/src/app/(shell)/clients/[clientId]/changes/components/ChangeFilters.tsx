/**
 * Change Filters Component
 * Phase 33: Auto-Fix System
 *
 * Filter controls for the changes list.
 * Fixed: HIGH-STATE-002 (race conditions), HIGH-STATE-004 (loading states),
 * HIGH-STATE-006 (debouncing)
 */
'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@tevero/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@tevero/ui';
import { Input } from '@tevero/ui';
import { Label } from '@tevero/ui';
import { Loader2 } from 'lucide-react';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';

interface ChangeFiltersProps {
  clientId: string;
}

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'meta_tags', label: 'Meta Tags' },
  { value: 'headings', label: 'Headings' },
  { value: 'images', label: 'Images' },
  { value: 'technical', label: 'Technical' },
  { value: 'content', label: 'Content' },
  { value: 'schema', label: 'Schema' },
  { value: 'links', label: 'Links' },
];

const STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'applied', label: 'Applied' },
  { value: 'verified', label: 'Verified' },
  { value: 'reverted', label: 'Reverted' },
  { value: 'failed', label: 'Failed' },
];

const TRIGGERED_BY = [
  { value: 'all', label: 'All Sources' },
  { value: 'audit', label: 'Audit' },
  { value: 'manual', label: 'Manual' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'revert', label: 'Revert' },
  { value: 'ai_suggestion', label: 'AI Suggestion' },
];

export function ChangeFilters({ clientId }: ChangeFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Track the latest filter request to prevent race conditions (HIGH-STATE-002)
  const latestRequestRef = useRef(0);

  const [category, setCategory] = useState(searchParams.get('category') ?? 'all');
  const [status, setStatus] = useState(searchParams.get('status') ?? 'all');
  const [triggeredBy, setTriggeredBy] = useState(searchParams.get('triggeredBy') ?? 'all');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') ?? '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') ?? '');

  // Sync local state with URL params on mount and when params change
  useEffect(() => {
    setCategory(searchParams.get('category') ?? 'all');
    setStatus(searchParams.get('status') ?? 'all');
    setTriggeredBy(searchParams.get('triggeredBy') ?? 'all');
    setDateFrom(searchParams.get('dateFrom') ?? '');
    setDateTo(searchParams.get('dateTo') ?? '');
  }, [searchParams]);

  const navigateWithFilters = (params: URLSearchParams) => {
    const requestId = ++latestRequestRef.current;
    const queryString = params.toString();
    const url = queryString
      ? `/clients/${clientId}/changes?${queryString}`
      : `/clients/${clientId}/changes`;

    startTransition(() => {
      // Only navigate if this is still the latest request (prevents race conditions)
      if (requestId === latestRequestRef.current) {
        router.push(url as Parameters<typeof router.push>[0]);
      }
    });
  };

  // Debounced filter application for date inputs (HIGH-STATE-006)
  const debouncedApplyFilters = useDebouncedCallback(() => {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.set('category', category);
    if (status && status !== 'all') params.set('status', status);
    if (triggeredBy && triggeredBy !== 'all') params.set('triggeredBy', triggeredBy);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    navigateWithFilters(params);
  }, 300);

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.set('category', category);
    if (status && status !== 'all') params.set('status', status);
    if (triggeredBy && triggeredBy !== 'all') params.set('triggeredBy', triggeredBy);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    navigateWithFilters(params);
  };

  const clearFilters = () => {
    setCategory('all');
    setStatus('all');
    setTriggeredBy('all');
    setDateFrom('');
    setDateTo('');

    startTransition(() => {
      router.push(`/clients/${clientId}/changes` as Parameters<typeof router.push>[0]);
    });
  };

  // Handle date changes with debouncing
  const handleDateFromChange = (value: string) => {
    setDateFrom(value);
    debouncedApplyFilters();
  };

  const handleDateToChange = (value: string) => {
    setDateTo(value);
    debouncedApplyFilters();
  };

  const hasActiveFilters =
    category !== 'all' ||
    status !== 'all' ||
    triggeredBy !== 'all' ||
    dateFrom ||
    dateTo;

  return (
    <div className={`bg-card rounded-lg border p-4 mb-6 transition-opacity ${isPending ? 'opacity-60' : ''}`}>
      {/* Loading indicator (HIGH-STATE-004) */}
      {isPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Updating filters...</span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Category Filter */}
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status Filter */}
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="status">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Triggered By Filter */}
        <div className="space-y-2">
          <Label htmlFor="triggeredBy">Source</Label>
          <Select value={triggeredBy} onValueChange={setTriggeredBy}>
            <SelectTrigger id="triggeredBy">
              <SelectValue placeholder="Select source" />
            </SelectTrigger>
            <SelectContent>
              {TRIGGERED_BY.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date From */}
        <div className="space-y-2">
          <Label htmlFor="dateFrom">From</Label>
          <Input
            id="dateFrom"
            type="date"
            value={dateFrom}
            onChange={(e) => handleDateFromChange(e.target.value)}
            disabled={isPending}
          />
        </div>

        {/* Date To */}
        <div className="space-y-2">
          <Label htmlFor="dateTo">To</Label>
          <Input
            id="dateTo"
            type="date"
            value={dateTo}
            onChange={(e) => handleDateToChange(e.target.value)}
            disabled={isPending}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2 mt-4">
        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters} disabled={isPending}>
            Clear Filters
          </Button>
        )}
        <Button onClick={applyFilters} disabled={isPending}>
          {isPending ? 'Applying...' : 'Apply Filters'}
        </Button>
      </div>
    </div>
  );
}
