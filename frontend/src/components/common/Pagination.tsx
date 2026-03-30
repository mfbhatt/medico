import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const visiblePages = pages.slice(Math.max(0, currentPage - 2), Math.min(totalPages, currentPage + 3));

  return (
    <div className="flex items-center justify-center gap-2">
      <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="p-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition">
        <ChevronLeft className="w-5 h-5" />
      </button>

      {visiblePages.map((page) => (
        <button key={page} onClick={() => onPageChange(page)} className={`px-3 py-2 rounded-lg font-semibold transition ${page === currentPage ? "bg-indigo-600 text-white" : "hover:bg-gray-100 text-gray-900"}`}>
          {page}
        </button>
      ))}

      <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition">
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
