/**
 * Change Filters Component
 * Phase 33: Auto-Fix System
 *
 * Filter controls for the changes list.
 */
'use client';

import { useState, useTransition } from 'react';
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

  const [category, setCategory] = useState(searchParams.get('category') ?? 'all');
  const [status, setStatus] = useState(searchParams.get('status') ?? 'all');
  const [triggeredBy, setTriggeredBy] = useState(searchParams.get('triggeredBy') ?? 'all');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') ?? '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') ?? '');

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.set('category', category);
    if (status && status !== 'all') params.set('status', status);
    if (triggeredBy && triggeredBy !== 'all') params.set('triggeredBy', triggeredBy);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);

    startTransition(() => {
      router.push(`/clients/${clientId}/changes?${params.toString()}`);
    });
  };

  const clearFilters = () => {
    setCategory('all');
    setStatus('all');
    setTriggeredBy('all');
    setDateFrom('');
    setDateTo('');

    startTransition(() => {
      router.push(`/clients/${clientId}/changes`);
    });
  };

  const hasActiveFilters =
    category !== 'all' ||
    status !== 'all' ||
    triggeredBy !== 'all' ||
    dateFrom ||
    dateTo;

  return (
    <div className="bg-card rounded-lg border p-4 mb-6">
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
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>

        {/* Date To */}
        <div className="space-y-2">
          <Label htmlFor="dateTo">To</Label>
          <Input
            id="dateTo"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
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
