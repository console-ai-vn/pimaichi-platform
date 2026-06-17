import { useEffect, useState, useCallback } from "react"

interface GridLayout {
	columns: number
	gap: number
}

const breakpoints: { query: string; columns: number }[] = [
	{ query: "(max-width: 767px)", columns: 2 },
	{ query: "(min-width: 768px) and (max-width: 1023px)", columns: 3 },
	{ query: "(min-width: 1024px)", columns: 4 },
]

/**
 * Returns responsive grid column count based on viewport width.
 * Uses matchMedia for efficient breakpoint detection.
 * Default: 2 columns (mobile), gap: 12px
 */
export function useGridLayout(): GridLayout {
	const [columns, setColumns] = useState(2)

	useEffect(() => {
		const mqls = breakpoints.map((bp) => {
			const mql = window.matchMedia(bp.query)
			const handler = (e: MediaQueryListEvent) => {
				if (e.matches) setColumns(bp.columns)
			}
			mql.addEventListener("change", handler)
			// Set initial
			if (mql.matches) setColumns(bp.columns)
			return { mql, handler }
		})

		return () => {
			for (const { mql, handler } of mqls) {
				mql.removeEventListener("change", handler)
			}
		}
	}, [])

	return { columns, gap: 12 }
}
