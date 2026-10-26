import { useRef, useEffect, useState, useMemo } from 'react';
import {
  DndContext, closestCenter,
  PointerSensor, KeyboardSensor, useSensor, useSensors
} from '@dnd-kit/core';
import {
  SortableContext, useSortable,
  rectSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical, RotateCw, Trash2, CheckSquare, Square,
  CheckCircle2, FileText, ChevronUp, ChevronDown
} from 'lucide-react';

function PageCard({
  page,
  index,
  thumbnailUrl,
  isActive,
  isSelected,
  onSelect,
  onActivate,
  onRotate,
  onDelete,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 40 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      onClick={() => onActivate(index)}
      className={`group relative rounded-xl p-2 border transition-all select-none cursor-pointer ${
        isActive
          ? 'ring-2 ring-cyan-500 shadow-md'
          : 'hover:border-cyan-500/40'
      }`}
      style={{
        ...style,
        backgroundColor: isActive ? 'var(--bg-elevated)' : 'var(--bg-surface)',
        borderColor: isActive ? 'var(--accent-primary)' : 'var(--border-subtle)',
      }}
    >
      {/* Top Card Bar: Checkbox, Page Number, Drag Handle */}
      <div className="flex items-center justify-between mb-1.5 text-[11px]">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(page.id);
            }}
            className="text-gray-400 hover:text-white transition-colors cursor-pointer"
            aria-label={isSelected ? `Bỏ chọn trang ${index + 1}` : `Chọn trang ${index + 1}`}
          >
            {isSelected ? (
              <CheckSquare size={13} className="text-cyan-400" />
            ) : (
              <Square size={13} />
            )}
          </button>
          <span className="font-mono font-bold text-gray-300">#{index + 1}</span>
          {page.rotation > 0 && (
            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-400 font-mono">
              {page.rotation}°
            </span>
          )}
        </div>

        <button
          {...attributes}
          {...listeners}
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-white"
          title="Kéo thả để sắp xếp vị trí trang"
        >
          <GripVertical size={13} />
        </button>
      </div>

      {/* Page Thumbnail Canvas Image or Placeholder */}
      <div
        className="relative w-full aspect-[3/4] rounded-lg overflow-hidden border border-black/5 dark:border-white/5 flex items-center justify-center transition-transform"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          transform: `rotate(${page.rotation || 0}deg)`,
        }}
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`Trang ${index + 1}`}
            className="w-full h-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-2 text-center text-gray-500">
            <FileText size={20} className="mb-1 opacity-40 animate-pulse" />
            <span className="text-[10px] font-mono">Trang {index + 1}</span>
          </div>
        )}
      </div>

      {/* Hover Action Buttons: Rotate & Delete */}
      <div className="mt-1.5 flex items-center justify-between opacity-80 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRotate(page.id);
          }}
          className="p-1 rounded-md text-gray-400 hover:text-amber-400 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
          title="Xoay 90° theo chiều kim đồng hồ"
          aria-label="Xoay trang 90 độ"
        >
          <RotateCw size={12} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(page.id);
          }}
          className="p-1 rounded-md text-gray-400 hover:text-red-400 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
          title="Xóa trang này"
          aria-label="Xóa trang"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

export default function ThumbnailRail({
  pages,
  activePageIndex,
  selectedPageIds,
  thumbnails,
  onActivatePage,
  onToggleSelectPage,
  onSelectAll,
  onDeselectAll,
  onRotatePage,
  onDeletePage,
  onReorderPages,
  onEnsureVisible,
}) {
  const containerRef = useRef(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Monitor scroll to request thumbnail renders only for pages near the visible window
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onEnsureVisible) return;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const cardHeight = 180;
          const scrollTop = el.scrollTop;
          const clientHeight = el.clientHeight;

          const startIdx = Math.max(0, Math.floor(scrollTop / cardHeight) - 3);
          const endIdx = Math.min(pages.length, Math.ceil((scrollTop + clientHeight) / cardHeight) + 3);

          const neededPages = [];
          for (let i = startIdx; i < endIdx; i++) {
            if (pages[i]) {
              neededPages.push(pages[i].originalPageNum);
            }
          }
          if (neededPages.length > 0) {
            onEnsureVisible(neededPages);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    // Trigger initial check
    handleScroll();

    return () => el.removeEventListener('scroll', handleScroll);
  }, [pages, onEnsureVisible]);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = pages.findIndex(p => p.id === active.id);
      const newIndex = pages.findIndex(p => p.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorderPages(oldIndex, newIndex);
      }
    }
  };

  const isAllSelected = pages.length > 0 && selectedPageIds.size === pages.length;

  return (
    <div
      className="w-56 shrink-0 border-r flex flex-col h-full select-none"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
      aria-label="Thanh cuộn trang PDF"
    >
      {/* Batch Header Controls */}
      <div className="p-2.5 border-b border-inherit flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={isAllSelected ? onDeselectAll : onSelectAll}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer text-[11px] font-semibold"
        >
          {isAllSelected ? <CheckSquare size={13} className="text-cyan-400" /> : <Square size={13} />}
          <span>{isAllSelected ? 'Bỏ chọn hết' : 'Chọn tất cả'}</span>
        </button>
        <span className="text-[10px] text-gray-500 font-mono">
          {pages.length} trang
        </span>
      </div>

      {/* Virtualized / Scrollable Sortable Cards List */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-2.5 space-y-2.5"
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={pages.map(p => p.id)} strategy={rectSortingStrategy}>
            {pages.map((page, idx) => (
              <PageCard
                key={page.id}
                page={page}
                index={idx}
                thumbnailUrl={thumbnails[page.originalPageNum]}
                isActive={activePageIndex === idx}
                isSelected={selectedPageIds.has(page.id)}
                onSelect={onToggleSelectPage}
                onActivate={onActivatePage}
                onRotate={onRotatePage}
                onDelete={onDeletePage}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
