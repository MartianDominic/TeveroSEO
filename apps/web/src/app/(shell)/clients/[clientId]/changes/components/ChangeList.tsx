/**
 * Change List Component
 * Phase 33: Auto-Fix System
 *
 * Displays a list of site changes with revert actions.
 */
'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@tevero/ui';
import { Badge } from '@tevero/ui';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tevero/ui';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@tevero/ui';
import { Undo2, ExternalLink } from 'lucide-react';
import type { Change } from '~/actions/changes';
import { RevertDialog } from './RevertDialog';

interface ChangeListProps {
  changes: Change[];
  connectionId: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  applied: 'bg-blue-100 text-blue-800',
  verified: 'bg-green-100 text-green-800',
  reverted: 'bg-gray-100 text-gray-800',
  failed: 'bg-red-100 text-red-800',
};

const CATEGORY_LABELS: Record<string, string> = {
  meta_tags: 'Meta Tags',
  headings: 'Headings',
  images: 'Images',
  technical: 'Technical',
  content: 'Content',
  schema: 'Schema',
  links: 'Links',
};

export function ChangeList({ changes, connectionId }: ChangeListProps) {
  const [selectedChange, setSelectedChange] = useState<Change | null>(null);
  const [isRevertDialogOpen, setIsRevertDialogOpen] = useState(false);

  const handleRevertClick = (change: Change) => {
    setSelectedChange(change);
    setIsRevertDialogOpen(true);
  };

  const canRevert = (change: Change) => {
    return change.status === 'verified' && !change.revertedAt;
  };

  if (changes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No changes found.</p>
        <p className="text-sm mt-2">Changes will appear here when SEO fixes are applied.</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Resource</TableHead>
            <TableHead>Field</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Before / After</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Applied</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {changes.map((change) => (
            <TableRow key={change.id}>
              {/* Resource */}
              <TableCell className="max-w-[200px]">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium" title={change.resourceUrl}>
                    {new URL(change.resourceUrl).pathname || '/'}
                  </span>
                  <a
                    href={change.resourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <span className="text-xs text-muted-foreground">{change.resourceType}</span>
              </TableCell>

              {/* Field */}
              <TableCell>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  {change.field}
                </code>
              </TableCell>

              {/* Category */}
              <TableCell>
                <Badge variant="outline">
                  {CATEGORY_LABELS[change.category] ?? change.category}
                </Badge>
              </TableCell>

              {/* Before / After */}
              <TableCell className="max-w-[300px]">
                <div className="space-y-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-xs text-muted-foreground truncate">
                        <span className="font-medium">Before:</span>{' '}
                        {change.beforeValue ? (
                          <span className="line-through">{truncateValue(change.beforeValue)}</span>
                        ) : (
                          <span className="italic">(empty)</span>
                        )}
                      </div>
                    </TooltipTrigger>
                    {change.beforeValue && (
                      <TooltipContent className="max-w-[400px]">
                        <p className="whitespace-pre-wrap">{change.beforeValue}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-xs text-foreground truncate">
                        <span className="font-medium">After:</span>{' '}
                        {change.afterValue ? (
                          <span className="text-green-600">{truncateValue(change.afterValue)}</span>
                        ) : (
                          <span className="italic">(empty)</span>
                        )}
                      </div>
                    </TooltipTrigger>
                    {change.afterValue && (
                      <TooltipContent className="max-w-[400px]">
                        <p className="whitespace-pre-wrap">{change.afterValue}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </div>
              </TableCell>

              {/* Source */}
              <TableCell>
                <span className="text-sm capitalize">{change.triggeredBy}</span>
              </TableCell>

              {/* Status */}
              <TableCell>
                <Badge className={STATUS_COLORS[change.status] ?? ''}>
                  {change.status}
                </Badge>
              </TableCell>

              {/* Applied */}
              <TableCell>
                {change.appliedAt ? (
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(change.appliedAt), { addSuffix: true })}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </TableCell>

              {/* Actions */}
              <TableCell className="text-right">
                {canRevert(change) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevertClick(change)}
                  >
                    <Undo2 className="h-4 w-4 mr-1" />
                    Revert
                  </Button>
                )}
                {change.revertedAt && (
                  <span className="text-xs text-muted-foreground">
                    Reverted
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Revert Dialog */}
      {selectedChange && (
        <RevertDialog
          isOpen={isRevertDialogOpen}
          onClose={() => {
            setIsRevertDialogOpen(false);
            setSelectedChange(null);
          }}
          change={selectedChange}
          connectionId={connectionId}
        />
      )}
    </TooltipProvider>
  );
}

function truncateValue(value: string, maxLength: number = 50): string {
  if (value.length <= maxLength) return value;
  return value.substring(0, maxLength) + '...';
}
