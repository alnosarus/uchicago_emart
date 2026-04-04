"use client";

import { useRef, useCallback, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import imageCompression from "browser-image-compression";
import { APP_CONFIG } from "@uchicago-marketplace/shared";

// --- Types ---

export type ImageItem =
  | { type: "local"; id: string; file: File; previewUrl: string }
  | { type: "remote"; id: string; image: { id: string; url: string; thumbUrl?: string | null } };

interface ImageUploadGridProps {
  images: ImageItem[];
  onImagesChange: (images: ImageItem[]) => void;
  maxImages?: number;
}

// --- Compression ---

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1200,
  useWebWorker: true,
  fileType: "image/webp" as const,
};

async function compressFile(file: File): Promise<File> {
  try {
    return await imageCompression(file, COMPRESSION_OPTIONS);
  } catch {
    // If compression fails (e.g. unsupported format), return original
    return file;
  }
}

// --- Sortable Thumbnail ---

function SortableImage({
  item,
  index,
  onRemove,
}: {
  item: ImageItem;
  index: number;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const src = item.type === "local" ? item.previewUrl : (item.image.thumbUrl || item.image.url);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative aspect-square rounded-lg overflow-hidden group"
      {...attributes}
      {...listeners}
    >
      <img src={src} alt={`Image ${index + 1}`} className="w-full h-full object-cover" />
      {index === 0 && (
        <span className="absolute top-1.5 left-1.5 bg-maroon-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
          Cover
        </span>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
      >
        &times;
      </button>
      <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-lg pointer-events-none" />
    </div>
  );
}

// --- Main Component ---

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/heic";

export function ImageUploadGrid({
  images,
  onImagesChange,
  maxImages = APP_CONFIG.maxImagesPerPost,
}: ImageUploadGridProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);
  const remaining = maxImages - images.length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files).slice(0, remaining);
      if (fileArray.length === 0) return;

      // Validate types
      const validFiles = fileArray.filter((f) =>
        ["image/jpeg", "image/png", "image/webp", "image/heic"].includes(f.type)
      );
      if (validFiles.length === 0) return;

      // Validate sizes (reject > 10MB)
      const sizedFiles = validFiles.filter((f) => f.size <= 10 * 1024 * 1024);

      setCompressing(true);
      try {
        const compressed = await Promise.all(sizedFiles.map(compressFile));
        const newItems: ImageItem[] = compressed.map((file) => ({
          type: "local",
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          previewUrl: URL.createObjectURL(file),
        }));
        onImagesChange([...images, ...newItems].slice(0, maxImages));
      } finally {
        setCompressing(false);
      }
    },
    [images, onImagesChange, maxImages, remaining]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = images.findIndex((img) => img.id === active.id);
      const newIndex = images.findIndex((img) => img.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      onImagesChange(arrayMove(images, oldIndex, newIndex));
    },
    [images, onImagesChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const removeImage = useCallback(
    (index: number) => {
      const item = images[index];
      if (item.type === "local") {
        URL.revokeObjectURL(item.previewUrl);
      }
      onImagesChange(images.filter((_, i) => i !== index));
    },
    [images, onImagesChange]
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-700">Photos</span>
        <span className="text-xs text-gray-400">
          {images.length}/{maxImages} photos
        </span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={images.map((img) => img.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-4 gap-2">
            {images.map((item, i) => (
              <SortableImage
                key={item.id}
                item={item}
                index={i}
                onRemove={() => removeImage(i)}
              />
            ))}

            {remaining > 0 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                disabled={compressing}
                className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors"
              >
                {compressing ? (
                  <span className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    <span className="text-[10px] mt-0.5">Add</span>
                  </>
                )}
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <p className="text-[11px] text-gray-400 mt-1.5">
        Drag to reorder. First image is the cover photo.
      </p>
    </div>
  );
}
