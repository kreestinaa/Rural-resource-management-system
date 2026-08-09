import { useState } from 'react'

export function Tooltip({ content, children, placement = 'top' }) {
  const [visible, setVisible] = useState(false)

  const PLACEMENT = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && content && (
        <span
          className={`absolute z-50 whitespace-nowrap bg-gray-900 text-white text-xs
                      px-2 py-1 rounded pointer-events-none ${PLACEMENT[placement] || PLACEMENT.top}`}
        >
          {content}
        </span>
      )}
    </span>
  )
}
