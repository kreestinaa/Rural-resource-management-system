export function Pagination({ page, totalPages, hasPrev, hasNext, pageNumbers, goTo, next, prev }) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-1 mt-4 flex-wrap">
      <PagBtn onClick={prev} disabled={!hasPrev}>‹ Prev</PagBtn>

      {pageNumbers.map((num, i) =>
        num === '...' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-gray-400 select-none">…</span>
        ) : (
          <PagBtn key={num} onClick={() => goTo(num)} active={num === page}>
            {num}
          </PagBtn>
        )
      )}

      <PagBtn onClick={next} disabled={!hasNext}>Next ›</PagBtn>
    </div>
  )
}

function PagBtn({ onClick, disabled, active, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1 rounded text-sm font-medium transition-colors
        ${active
          ? 'bg-blue-600 text-white'
          : disabled
          ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
    >
      {children}
    </button>
  )
}
