import { useEffect } from 'react'

/**
 * Poll while the tab is actually being looked at.
 *
 * The dashboard reads five endpoints and each one walks whole Firestore
 * collections, so a tab left open overnight was billing thousands of reads an
 * hour and keeping Cloud Run awake for nobody. Hidden tabs now poll nothing,
 * and a tab coming back to the foreground refreshes immediately.
 */
export function usePoll(fn: () => void, intervalMs: number) {
  useEffect(() => {
    let timer: number | undefined

    const stop = () => {
      if (timer !== undefined) {
        clearInterval(timer)
        timer = undefined
      }
    }

    const start = () => {
      stop()
      timer = window.setInterval(fn, intervalMs)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        fn()
        start()
      } else {
        stop()
      }
    }

    fn()
    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [fn, intervalMs])
}
