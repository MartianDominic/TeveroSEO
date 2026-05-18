# Research 12: Content Editor UX

> **Agent:** 12  
> **Focus:** WYSIWYG editor, real-time quality scoring sidebar, SEO recommendations panel, revision history, v6 design compliance  
> **Status:** Research Complete  
> **Created:** 2026-05-11

---

## Executive Summary

The Content Editor UX is the central workspace where content creators draft, refine, and optimize SEO content. This research defines a TipTap-based WYSIWYG editor with real-time quality scoring, inline SEO recommendations, revision history, and full v6 design system compliance. The goal: a distraction-free writing experience that surfaces SEO insights without interrupting creative flow.

---

## 1. Architecture Overview

### 1.1 Editor Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **WYSIWYG Core** | TipTap v2 (ProseMirror) | Headless, extensible, React-native, MIT license |
| **State Management** | Zustand | Lightweight, already in codebase, no boilerplate |
| **Real-time Scoring** | Debounced analysis (500ms) | Balance responsiveness with compute cost |
| **Revision Storage** | PostgreSQL JSONB + Diff | Efficient storage, full history reconstruction |
| **SEO Analysis** | seobuild-onpage integration | 109 checks, 4-tier severity |

### 1.2 Component Architecture

```
ContentEditorPage
├── EditorShell (3-column v6 layout)
│   ├── LeftSidebar (document outline, word count)
│   ├── MainEditor (TipTap canvas)
│   │   ├── EditorToolbar (formatting controls)
│   │   ├── TipTapEditor (content area)
│   │   └── EditorFooter (autosave status, keyboard hints)
│   └── RightRail (SEO + Quality panels)
│       ├── QualityScoringPanel
│       ├── SEORecommendationsPanel
│       └── RevisionHistoryPanel
└── CommandPalette (Cmd+K quick actions)
```

---

## 2. TipTap Editor Configuration

### 2.1 Core Extensions

```typescript
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Typography from '@tiptap/extension-typography'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      codeBlock: { HTMLAttributes: { class: 't-mono' } },
    }),
    Placeholder.configure({
      placeholder: 'Start writing your article...',
    }),
    CharacterCount.configure({
      limit: null, // No hard limit, but track for scoring
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { class: 'editor-link' },
    }),
    Image.configure({
      inline: false,
      HTMLAttributes: { class: 'editor-image' },
    }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    Typography, // Smart quotes, em-dashes
    Highlight.configure({ multicolor: true }),
    TaskList,
    TaskItem.configure({ nested: true }),
  ],
  editorProps: {
    attributes: {
      class: 'prose prose-sm max-w-none focus:outline-none',
      spellcheck: 'true',
    },
  },
})
```

### 2.2 Custom Extensions

#### SEO Highlight Extension

Highlights keyword occurrences, missing alt text, overlength paragraphs:

```typescript
import { Mark, mergeAttributes } from '@tiptap/core'

export const SEOHighlight = Mark.create({
  name: 'seoHighlight',
  addAttributes() {
    return {
      type: {
        default: 'keyword', // 'keyword' | 'warning' | 'error'
      },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-seo-highlight]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-seo-highlight': HTMLAttributes.type,
      class: `seo-highlight seo-highlight--${HTMLAttributes.type}`,
    }), 0]
  },
})
```

#### Internal Link Suggestion Extension

Surfaces internal linking opportunities inline:

```typescript
export const InternalLinkSuggestion = Node.create({
  name: 'internalLinkSuggestion',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return {
      targetUrl: { default: '' },
      anchorText: { default: '' },
      confidence: { default: 0 },
    }
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', {
      class: 'internal-link-suggestion',
      'data-url': HTMLAttributes.targetUrl,
      'data-anchor': HTMLAttributes.anchorText,
    }, `Link: ${HTMLAttributes.anchorText}`]
  },
})
```

### 2.3 Editor Styling (v6 Compliance)

```css
/* TipTap editor canvas - v6 design system */
.editor-canvas {
  font-family: var(--font-sans);
  font-size: var(--type-body);
  line-height: 1.55;
  color: var(--text-1);
  background: var(--surface);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: var(--space-7);
  min-height: 60vh;
}

.editor-canvas:focus-within {
  box-shadow: var(--shadow-lift);
}

/* Headings use Newsreader serif */
.editor-canvas h1,
.editor-canvas h2,
.editor-canvas h3 {
  font-family: var(--font-display);
  letter-spacing: -0.018em;
  color: var(--text-1);
  margin-top: var(--space-6);
  margin-bottom: var(--space-4);
}

.editor-canvas h1 { font-size: var(--type-h1); font-weight: 400; }
.editor-canvas h2 { font-size: var(--type-h2); font-weight: 500; }
.editor-canvas h3 { font-size: var(--type-h3); font-weight: 500; }

/* Links - accent color */
.editor-canvas a,
.editor-link {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* Code blocks - Geist Mono */
.editor-canvas code,
.editor-canvas pre {
  font-family: var(--font-mono);
  font-size: 13px;
  background: var(--surface-2);
  border-radius: var(--radius-input);
}

.editor-canvas pre {
  padding: var(--space-4);
  overflow-x: auto;
}

.editor-canvas code {
  padding: 2px 6px;
}

/* SEO highlights */
.seo-highlight--keyword {
  background: var(--accent-soft);
  border-radius: 2px;
}

.seo-highlight--warning {
  background: var(--warning-soft);
  border-bottom: 2px dashed var(--warning);
}

.seo-highlight--error {
  background: var(--error-soft);
  border-bottom: 2px wavy var(--error);
}

/* Internal link suggestions - hover-to-reveal */
.internal-link-suggestion {
  background: var(--info-soft);
  padding: 2px 6px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--motion-reveal);
}

.editor-canvas:hover .internal-link-suggestion,
.internal-link-suggestion:focus {
  opacity: 1;
}
```

---

## 3. Real-Time Quality Scoring Sidebar

### 3.1 Score Calculation

The quality score (0-100) is calculated from weighted factors:

| Factor | Weight | Scoring Criteria |
|--------|--------|------------------|
| **Word Count** | 15% | Target +/- 10% = 100, outside range = proportional deduction |
| **Readability** | 20% | Flesch-Kincaid Grade Level 6-9 = 100, >12 = 50 |
| **Keyword Density** | 15% | 1-2% = 100, 0% or >3% = 50 |
| **Heading Structure** | 10% | H1 present, H2s logical = 100 |
| **Internal Links** | 10% | 3+ internal links = 100, 0 = 0 |
| **External Links** | 5% | 1+ authoritative external = 100 |
| **Image Optimization** | 10% | All images have alt text = 100 |
| **Voice Compliance** | 15% | VoiceConstraintBuilder score |

### 3.2 Quality Panel Component

```typescript
interface QualityScore {
  total: number
  breakdown: {
    wordCount: { score: number; actual: number; target: number }
    readability: { score: number; grade: number }
    keywordDensity: { score: number; density: number }
    headingStructure: { score: number; issues: string[] }
    internalLinks: { score: number; count: number }
    externalLinks: { score: number; count: number }
    imageOptimization: { score: number; missing: number }
    voiceCompliance: { score: number; warnings: string[] }
  }
  passesGate: boolean // score >= 80
}

function QualityScoringPanel({ score }: { score: QualityScore }) {
  return (
    <div className="rail-section">
      {/* Editorial moment - the score */}
      <div className="quality-hero">
        <span className="num-hero">{score.total}</span>
        <span className="quality-label">/100</span>
      </div>
      
      {/* Status pill */}
      <StatusPill 
        status={score.passesGate ? 'on-track' : 'warning'}
        label={score.passesGate ? 'READY TO PUBLISH' : 'NEEDS WORK'}
      />
      
      {/* Breakdown bars */}
      <div className="quality-breakdown">
        {Object.entries(score.breakdown).map(([key, data]) => (
          <QualityFactorRow 
            key={key}
            label={formatFactorLabel(key)}
            score={data.score}
            detail={formatFactorDetail(key, data)}
          />
        ))}
      </div>
    </div>
  )
}
```

### 3.3 Real-Time Update Flow

```typescript
// Debounced analysis hook
function useQualityScore(content: string, targetKeyword: string) {
  const [score, setScore] = useState<QualityScore | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  
  const debouncedContent = useDebounce(content, 500)
  
  useEffect(() => {
    if (!debouncedContent) return
    
    setIsAnalyzing(true)
    
    // Run analysis in web worker to avoid blocking UI
    analyzeContentWorker.postMessage({
      content: debouncedContent,
      targetKeyword,
    })
    
    const handleResult = (e: MessageEvent<QualityScore>) => {
      setScore(e.data)
      setIsAnalyzing(false)
    }
    
    analyzeContentWorker.addEventListener('message', handleResult)
    return () => analyzeContentWorker.removeEventListener('message', handleResult)
  }, [debouncedContent, targetKeyword])
  
  return { score, isAnalyzing }
}
```

---

## 4. SEO Recommendations Panel

### 4.1 Recommendation Categories

| Category | Priority | Source |
|----------|----------|--------|
| **Title Tag** | Critical | seobuild-onpage Tier 1 |
| **Meta Description** | High | seobuild-onpage Tier 2 |
| **Heading Hierarchy** | High | Real-time analysis |
| **Keyword Placement** | Medium | Real-time analysis |
| **Internal Linking** | Medium | Link opportunity detector |
| **Image Alt Text** | Medium | Real-time analysis |
| **Schema Markup** | Low | seobuild-onpage Tier 3 |
| **Content Length** | Info | Word count comparison |

### 4.2 Recommendation Interface

```typescript
interface SEORecommendation {
  id: string
  category: 'title' | 'meta' | 'heading' | 'keyword' | 'link' | 'image' | 'schema' | 'content'
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  title: string
  description: string
  currentValue?: string
  recommendedValue?: string
  autoFixAvailable: boolean
  position?: { from: number; to: number } // For inline highlighting
}

function SEORecommendationsPanel({ 
  recommendations,
  onApplyFix,
  onDismiss,
}: {
  recommendations: SEORecommendation[]
  onApplyFix: (id: string) => void
  onDismiss: (id: string) => void
}) {
  const grouped = groupBy(recommendations, 'severity')
  
  return (
    <div className="rail-section seo-panel">
      <div className="card-head">
        <span className="ic">
          <SearchIcon className="h-4 w-4" />
        </span>
        <span className="title">SEO Recommendations</span>
        <span className="meta">{recommendations.length} items</span>
      </div>
      
      {/* Critical issues first */}
      {grouped.critical?.length > 0 && (
        <RecommendationGroup 
          severity="critical"
          items={grouped.critical}
          onApplyFix={onApplyFix}
          onDismiss={onDismiss}
        />
      )}
      
      {/* High priority */}
      {grouped.high?.length > 0 && (
        <RecommendationGroup 
          severity="high"
          items={grouped.high}
          onApplyFix={onApplyFix}
          onDismiss={onDismiss}
        />
      )}
      
      {/* Collapsible medium/low/info */}
      <CollapsibleSection title="More suggestions">
        {[...grouped.medium ?? [], ...grouped.low ?? [], ...grouped.info ?? []].map(rec => (
          <RecommendationRow key={rec.id} recommendation={rec} />
        ))}
      </CollapsibleSection>
    </div>
  )
}
```

### 4.3 Inline SEO Indicators

Visual indicators appear in the editor for actionable items:

```typescript
// Mark problematic areas in the editor
function applyInlineSEOMarks(editor: Editor, recommendations: SEORecommendation[]) {
  recommendations
    .filter(rec => rec.position)
    .forEach(rec => {
      editor.commands.setMark('seoHighlight', {
        type: rec.severity === 'critical' ? 'error' : 
              rec.severity === 'high' ? 'warning' : 'keyword',
      })
    })
}
```

---

## 5. Revision History System

### 5.1 Data Model

```typescript
interface Revision {
  id: string
  articleId: string
  version: number
  content: string // Full HTML content
  diff: string // JSON diff from previous version
  author: {
    id: string
    name: string
    type: 'human' | 'ai'
  }
  metadata: {
    wordCount: number
    qualityScore: number
    generationSource?: 'manual' | 'ai-generate' | 'ai-regenerate' | 'auto-fix'
  }
  createdAt: string
}

// Database schema (Drizzle)
export const revisions = pgTable('article_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  articleId: uuid('article_id').references(() => articles.id).notNull(),
  version: integer('version').notNull(),
  content: text('content').notNull(),
  diff: jsonb('diff'),
  authorId: uuid('author_id').references(() => users.id),
  authorType: varchar('author_type', { length: 10 }).notNull(),
  wordCount: integer('word_count'),
  qualityScore: integer('quality_score'),
  generationSource: varchar('generation_source', { length: 20 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

### 5.2 Revision Panel Component

```typescript
function RevisionHistoryPanel({
  revisions,
  currentVersion,
  onRestore,
  onCompare,
}: {
  revisions: Revision[]
  currentVersion: number
  onRestore: (version: number) => void
  onCompare: (v1: number, v2: number) => void
}) {
  return (
    <div className="rail-section revision-panel">
      <div className="card-head">
        <span className="ic">
          <HistoryIcon className="h-4 w-4" />
        </span>
        <span className="title">Revision History</span>
        <span className="meta">v{currentVersion}</span>
      </div>
      
      <div className="revision-list">
        {revisions.map((rev, idx) => (
          <RevisionRow
            key={rev.id}
            revision={rev}
            isCurrent={rev.version === currentVersion}
            showDiff={idx < revisions.length - 1}
            onRestore={() => onRestore(rev.version)}
            onCompare={() => onCompare(rev.version, revisions[idx + 1]?.version)}
          />
        ))}
      </div>
    </div>
  )
}

function RevisionRow({ revision, isCurrent, onRestore, onCompare }) {
  return (
    <div className={`revision-row ${isCurrent ? 'revision-row--current' : ''}`}>
      <div className="revision-meta">
        <span className="revision-version">v{revision.version}</span>
        <span className="revision-time">
          {formatRelativeTime(revision.createdAt)}
        </span>
      </div>
      
      <div className="revision-author">
        {revision.author.type === 'ai' ? (
          <span className="badge badge--ai">AI</span>
        ) : (
          <span className="revision-author-name">{revision.author.name}</span>
        )}
      </div>
      
      <div className="revision-stats">
        <span>{revision.metadata.wordCount} words</span>
        <span>Score: {revision.metadata.qualityScore}</span>
      </div>
      
      {/* Hover-to-reveal actions */}
      <div className="revision-actions">
        <button onClick={onCompare} className="ghost-btn">
          Compare
        </button>
        {!isCurrent && (
          <button onClick={onRestore} className="ghost-btn">
            Restore
          </button>
        )}
      </div>
    </div>
  )
}
```

### 5.3 Diff Viewer

```typescript
// Use diff-match-patch for efficient diffing
import { diff_match_patch } from 'diff-match-patch'

function DiffViewer({ 
  oldContent, 
  newContent 
}: { 
  oldContent: string
  newContent: string 
}) {
  const dmp = new diff_match_patch()
  const diffs = dmp.diff_main(oldContent, newContent)
  dmp.diff_cleanupSemantic(diffs)
  
  return (
    <div className="diff-viewer">
      {diffs.map(([op, text], idx) => (
        <span
          key={idx}
          className={
            op === 1 ? 'diff-added' :
            op === -1 ? 'diff-removed' :
            'diff-unchanged'
          }
        >
          {text}
        </span>
      ))}
    </div>
  )
}
```

---

## 6. Keyboard Shortcuts

### 6.1 Complete Shortcut Map

| Category | Shortcut | Action |
|----------|----------|--------|
| **Formatting** | | |
| | Cmd+B | Bold |
| | Cmd+I | Italic |
| | Cmd+U | Underline |
| | Cmd+Shift+S | Strikethrough |
| | Cmd+E | Inline code |
| | Cmd+Shift+H | Highlight |
| **Headings** | | |
| | Cmd+Alt+1 | Heading 1 |
| | Cmd+Alt+2 | Heading 2 |
| | Cmd+Alt+3 | Heading 3 |
| | Cmd+Alt+0 | Paragraph |
| **Lists** | | |
| | Cmd+Shift+7 | Ordered list |
| | Cmd+Shift+8 | Bullet list |
| | Cmd+Shift+9 | Task list |
| | Tab | Indent list |
| | Shift+Tab | Outdent list |
| **Links & Media** | | |
| | Cmd+K | Insert/edit link |
| | Cmd+Shift+I | Insert image |
| **Blocks** | | |
| | Cmd+Shift+B | Blockquote |
| | Cmd+Alt+C | Code block |
| | Cmd+Enter | Horizontal rule |
| **Navigation** | | |
| | Cmd+Home | Go to start |
| | Cmd+End | Go to end |
| | Cmd+G | Go to line |
| **Actions** | | |
| | Cmd+S | Save draft |
| | Cmd+Shift+S | Save and exit |
| | Cmd+Z | Undo |
| | Cmd+Shift+Z | Redo |
| | Cmd+P | Preview mode |
| | Cmd+/ | Toggle comment |
| **SEO Tools** | | |
| | Cmd+Shift+K | Open SEO panel |
| | Cmd+Shift+Q | Open quality panel |
| | Cmd+Shift+L | Insert internal link |
| | Cmd+Shift+A | Add alt text to image |
| **Quick Actions** | | |
| | Cmd+K (global) | Command palette |
| | Escape | Close panel/modal |
| | F11 | Fullscreen mode |

### 6.2 Keyboard Shortcut Implementation

```typescript
// TipTap keyboard extension
const KeyboardShortcuts = Extension.create({
  name: 'keyboardShortcuts',
  
  addKeyboardShortcuts() {
    return {
      'Mod-s': () => {
        this.editor.commands.saveDraft()
        return true
      },
      'Mod-Shift-s': () => {
        this.editor.commands.saveAndExit()
        return true
      },
      'Mod-p': () => {
        this.editor.commands.togglePreview()
        return true
      },
      'Mod-Shift-k': () => {
        toggleSEOPanel()
        return true
      },
      'Mod-Shift-q': () => {
        toggleQualityPanel()
        return true
      },
      'Mod-Shift-l': () => {
        openInternalLinkDialog()
        return true
      },
      'F11': () => {
        toggleFullscreen()
        return true
      },
    }
  },
})
```

### 6.3 Keyboard Hints Display (v6 Compliant)

```typescript
function KeyboardHints() {
  return (
    <div className="keyboard-hints">
      <span className="hint">
        <kbd>Cmd</kbd>+<kbd>K</kbd> Commands
      </span>
      <span className="hint">
        <kbd>Cmd</kbd>+<kbd>S</kbd> Save
      </span>
      <span className="hint">
        <kbd>Cmd</kbd>+<kbd>P</kbd> Preview
      </span>
    </div>
  )
}
```

CSS for hints (hover-to-reveal per v6):

```css
.keyboard-hints {
  display: flex;
  gap: var(--space-4);
  opacity: 0;
  transition: opacity var(--motion-reveal);
}

.editor-footer:hover .keyboard-hints {
  opacity: 1;
}

.hint {
  font-size: 12px;
  color: var(--text-3);
}

kbd {
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--surface-2);
  box-shadow: 0 0 0 1px var(--hairline);
  border-radius: 4px;
  padding: 1px 5px;
}
```

---

## 7. Component Specifications

### 7.1 EditorToolbar

```typescript
interface ToolbarProps {
  editor: Editor
  isPreviewMode: boolean
  onTogglePreview: () => void
}

function EditorToolbar({ editor, isPreviewMode, onTogglePreview }: ToolbarProps) {
  return (
    <div className="editor-toolbar">
      {/* Format group */}
      <ToolbarGroup>
        <ToolbarButton
          icon={<BoldIcon />}
          label="Bold"
          shortcut="Cmd+B"
          isActive={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          icon={<ItalicIcon />}
          label="Italic"
          shortcut="Cmd+I"
          isActive={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        {/* ... more formatting buttons */}
      </ToolbarGroup>
      
      <ToolbarDivider />
      
      {/* Heading group */}
      <ToolbarGroup>
        <HeadingDropdown editor={editor} />
      </ToolbarGroup>
      
      <ToolbarDivider />
      
      {/* List group */}
      <ToolbarGroup>
        <ToolbarButton
          icon={<ListOrderedIcon />}
          label="Ordered list"
          isActive={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          icon={<ListIcon />}
          label="Bullet list"
          isActive={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
      </ToolbarGroup>
      
      <ToolbarDivider />
      
      {/* Insert group */}
      <ToolbarGroup>
        <ToolbarButton
          icon={<LinkIcon />}
          label="Insert link"
          shortcut="Cmd+K"
          onClick={() => openLinkDialog()}
        />
        <ToolbarButton
          icon={<ImageIcon />}
          label="Insert image"
          shortcut="Cmd+Shift+I"
          onClick={() => openImageDialog()}
        />
        <ToolbarButton
          icon={<TableIcon />}
          label="Insert table"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3 }).run()}
        />
      </ToolbarGroup>
      
      <div className="grow" />
      
      {/* View controls */}
      <ToolbarGroup>
        <ToolbarButton
          icon={isPreviewMode ? <EditIcon /> : <EyeIcon />}
          label={isPreviewMode ? 'Edit' : 'Preview'}
          shortcut="Cmd+P"
          onClick={onTogglePreview}
        />
      </ToolbarGroup>
    </div>
  )
}
```

### 7.2 EditorFooter

```typescript
function EditorFooter({ 
  editor,
  isDirty,
  isSaving,
  lastSavedAt,
  wordCount,
  targetWordCount,
}: {
  editor: Editor
  isDirty: boolean
  isSaving: boolean
  lastSavedAt: Date | null
  wordCount: number
  targetWordCount: number
}) {
  const characterCount = editor.storage.characterCount.characters()
  
  return (
    <div className="editor-footer">
      {/* Save status */}
      <div className="save-status">
        {isSaving && (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Saving...</span>
          </>
        )}
        {!isSaving && isDirty && (
          <>
            <span className="status-dot status-dot--unsaved" />
            <span>Unsaved changes</span>
          </>
        )}
        {!isSaving && !isDirty && lastSavedAt && (
          <>
            <CheckCircle className="h-3 w-3 text-success" />
            <span>Saved {formatRelativeTime(lastSavedAt)}</span>
          </>
        )}
      </div>
      
      <div className="grow" />
      
      {/* Word count */}
      <div className="word-count">
        <span className={wordCount >= targetWordCount ? 'text-success' : ''}>
          {wordCount.toLocaleString()}
        </span>
        <span className="text-text-3"> / {targetWordCount.toLocaleString()} words</span>
      </div>
      
      <span className="sep">|</span>
      
      {/* Character count */}
      <div className="char-count text-text-3">
        {characterCount.toLocaleString()} characters
      </div>
      
      <span className="sep">|</span>
      
      {/* Keyboard hints - hover-to-reveal */}
      <KeyboardHints />
    </div>
  )
}
```

### 7.3 Command Palette

```typescript
interface Command {
  id: string
  label: string
  shortcut?: string
  category: 'format' | 'insert' | 'seo' | 'action' | 'navigation'
  action: () => void
}

function CommandPalette({ 
  isOpen,
  onClose,
  commands,
}: {
  isOpen: boolean
  onClose: () => void
  commands: Command[]
}) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  
  const filtered = commands.filter(cmd => 
    cmd.label.toLowerCase().includes(query.toLowerCase())
  )
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        filtered[selectedIndex]?.action()
        onClose()
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, filtered, selectedIndex, onClose])
  
  if (!isOpen) return null
  
  return (
    <div className="command-palette-overlay">
      <div className="command-palette card">
        <div className="command-input-wrap">
          <SearchIcon className="command-search-icon" />
          <input
            className="command-input"
            placeholder="Type a command..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            autoFocus
          />
          <kbd className="command-close-hint">Esc</kbd>
        </div>
        
        <div className="command-list">
          {filtered.map((cmd, idx) => (
            <button
              key={cmd.id}
              className={`command-item ${idx === selectedIndex ? 'command-item--selected' : ''}`}
              onClick={() => {
                cmd.action()
                onClose()
              }}
            >
              <span className="command-label">{cmd.label}</span>
              {cmd.shortcut && (
                <span className="command-shortcut">
                  {cmd.shortcut.split('+').map((key, i) => (
                    <kbd key={i}>{key}</kbd>
                  ))}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

---

## 8. v6 Design System Compliance Checklist

### 8.1 Typography

| Element | v6 Requirement | Implementation |
|---------|---------------|----------------|
| Editor body | 14px Geist, line-height 1.55 | `.editor-canvas { font-size: var(--type-body) }` |
| Headings | Newsreader serif, tight tracking | `h1-h4 { font-family: var(--font-display) }` |
| Code | Geist Mono, 13px | `.t-mono { font-family: var(--font-mono) }` |
| Kbd chips | 12px mono, shadow | `.kbd` class per v6 spec |
| Labels | 12px floor | `--type-tiny: 12px` |

### 8.2 Colors

| Element | Token | Value |
|---------|-------|-------|
| Editor background | `--surface` | #FFFFFF |
| Text | `--text-1` | #14141A |
| Muted text | `--text-3` | #93939A |
| Links | `--accent` | #0F4F3D |
| Keyword highlight | `--accent-soft` | #EAF1ED |
| Warning highlight | `--warning-soft` | #F4EDDA |
| Error highlight | `--error-soft` | #F4E6E6 |

### 8.3 Shadows

| Element | Token | Usage |
|---------|-------|-------|
| Editor card | `--shadow-card` | At rest |
| Editor focused | `--shadow-lift` | On focus |
| Toolbar buttons | `--shadow-pop` | On hover |
| Kbd chips | `0 0 0 1px var(--hairline)` | Static |

### 8.4 Motion

| Interaction | Duration | Easing |
|-------------|----------|--------|
| Hover state | 160ms | `--ease-quick` |
| Panel reveal | 240ms | `--ease-smooth` |
| Card lift | 280ms | `--ease-smooth` |

### 8.5 Hover-to-Reveal Elements

Per v6 philosophy, these elements are hidden at rest:

- Keyboard hints in footer
- Toolbar button labels
- Revision row actions
- SEO recommendation dismiss buttons
- Internal link suggestions

---

## 9. Integration Points

### 9.1 With AI Content Pipeline (Agent 9)

```typescript
// Regenerate content via AI
async function regenerateSection(
  sectionId: string,
  instructions: string
): Promise<string> {
  const response = await fetch('/api/content/regenerate-section', {
    method: 'POST',
    body: JSON.stringify({
      articleId,
      sectionId,
      instructions,
      voiceProfileId,
    }),
  })
  return response.json()
}
```

### 9.2 With Voice Compliance (Agent 10)

```typescript
// Real-time voice score
function useVoiceScore(content: string, voiceProfileId: string) {
  return useQuery({
    queryKey: ['voice-score', content, voiceProfileId],
    queryFn: () => analyzeVoiceCompliance(content, voiceProfileId),
    enabled: content.length > 100,
  })
}
```

### 9.3 With Quality Gate (Agent 11)

```typescript
// Quality gate check before publish
async function checkQualityGate(articleId: string): Promise<{
  passes: boolean
  score: number
  failures: string[]
}> {
  return fetch(`/api/articles/${articleId}/quality-gate`).then(r => r.json())
}
```

### 9.4 With seobuild-onpage (Phase 92)

```typescript
// Run on-page SEO checks
async function runSEOChecks(content: string, targetKeyword: string): Promise<{
  tier1: SEOCheck[]
  tier2: SEOCheck[]
  tier3: SEOCheck[]
  tier4: SEOCheck[]
}> {
  return fetch('/api/seo/analyze', {
    method: 'POST',
    body: JSON.stringify({ content, targetKeyword }),
  }).then(r => r.json())
}
```

---

## 10. Migration from Current Editor

### 10.1 Current State (ArticleEditorPage.tsx)

The existing editor in `AI-Writer/frontend/src/pages/ArticleEditorPage.tsx`:
- Uses basic `<Textarea>` + HTML preview
- Has autosave, status polling, voice warnings
- No WYSIWYG, no real-time SEO, no revision history

### 10.2 Migration Path

| Phase | Scope | Effort |
|-------|-------|--------|
| **M1** | Add TipTap core, replace textarea | 3 days |
| **M2** | Build quality scoring panel | 2 days |
| **M3** | Build SEO recommendations panel | 2 days |
| **M4** | Add revision history | 2 days |
| **M5** | Implement keyboard shortcuts | 1 day |
| **M6** | v6 design polish | 2 days |
| **Total** | | **12 days** |

### 10.3 Backwards Compatibility

- Existing articles with `html_content` load into TipTap
- No schema changes required for basic migration
- Revision history requires new `article_revisions` table

---

## 11. Performance Considerations

### 11.1 Large Document Handling

- TipTap handles 50K+ word documents efficiently
- Use virtualization for revision list (>100 items)
- Lazy load SEO analysis on demand

### 11.2 Real-Time Analysis Budget

```
Quality score analysis: <100ms target
SEO recommendations: <200ms target
Voice compliance: <300ms target (web worker)

Total analysis cycle: <500ms with 500ms debounce = 1s max latency
```

### 11.3 Autosave Strategy

- Debounce: 2000ms (current behavior)
- Minimum interval: 5000ms (prevent save storms)
- Conflict detection: Compare timestamps before save

---

## 12. Accessibility

### 12.1 WCAG 2.1 AA Compliance

| Requirement | Implementation |
|-------------|----------------|
| Keyboard navigation | Full TipTap + custom shortcuts |
| Focus indicators | `:focus-visible` styling |
| Screen reader | ARIA labels on toolbar buttons |
| Color contrast | v6 tokens meet 4.5:1 minimum |
| Text sizing | 12px floor per v6 |

### 12.2 ARIA Implementation

```typescript
<button
  role="button"
  aria-label="Bold (Cmd+B)"
  aria-pressed={editor.isActive('bold')}
  onClick={() => editor.chain().focus().toggleBold().run()}
>
  <BoldIcon aria-hidden="true" />
</button>
```

---

## 13. Summary

The Content Editor UX combines TipTap's powerful WYSIWYG capabilities with TeveroSEO's real-time quality scoring and SEO recommendation engine. Key features:

1. **TipTap v2** with custom SEO extensions for inline highlighting
2. **Real-time quality scoring** (500ms debounce) with 8-factor breakdown
3. **SEO recommendations panel** integrated with seobuild-onpage 109 checks
4. **Revision history** with diff viewer and one-click restore
5. **30+ keyboard shortcuts** for power users
6. **Full v6 design compliance** including hover-to-reveal patterns

The migration from the current basic editor requires approximately 12 days and preserves backwards compatibility with existing article content.

---

*Research complete. Ready for implementation planning.*
