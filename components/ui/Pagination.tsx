"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav className="flex items-center justify-center gap-1" aria-label="Pagination">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Page précédente"
        className="w-11 h-11 flex items-center justify-center rounded-mf-sm text-mf-text-2 hover:text-mf-text hover:bg-mf-surface-2 disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-mf-blue"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          aria-current={p === page ? "page" : undefined}
          className={`min-w-[44px] h-11 px-2 rounded-mf-sm text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-mf-blue ${
            p === page ? "bg-mf-blue text-white" : "text-mf-text-2 hover:text-mf-text hover:bg-mf-surface-2"
          }`}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Page suivante"
        className="w-11 h-11 flex items-center justify-center rounded-mf-sm text-mf-text-2 hover:text-mf-text hover:bg-mf-surface-2 disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-mf-blue"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </nav>
  );
}
