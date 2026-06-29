"use client";

import { useState, type DragEvent } from "react";

// Generic drag-and-drop primitive: spread `dropHandlers` onto any Box to make
// it accept dropped files (in addition to whatever click-to-browse input it already has).
export function useFileDrop(onFiles: (files: File[]) => void, accept = "image/") {
    const [isDragging, setIsDragging] = useState(false);

    function filterFiles(fileList: FileList | null): File[] {
        if (!fileList) return [];
        return Array.from(fileList).filter(f => !accept || f.type.startsWith(accept));
    }

    const dropHandlers = {
        onDragEnter: (e: DragEvent) => { e.preventDefault(); setIsDragging(true); },
        onDragOver: (e: DragEvent) => { e.preventDefault(); },
        onDragLeave: (e: DragEvent) => {
            e.preventDefault();
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setIsDragging(false);
        },
        onDrop: (e: DragEvent) => {
            e.preventDefault();
            setIsDragging(false);
            const files = filterFiles(e.dataTransfer.files);
            if (files.length) onFiles(files);
        },
    };

    return { isDragging, dropHandlers };
}
