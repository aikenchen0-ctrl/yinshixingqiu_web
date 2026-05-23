interface SyncButtonProps {
  busy: boolean
  disabled: boolean
  onClick: () => void
}

export function SyncButton({ busy, disabled, onClick }: SyncButtonProps) {
  return (
    <button className="popup-primary-button" disabled={disabled || busy} onClick={onClick} type="button">
      {busy ? '提交中...' : '提交到小程序的文章'}
    </button>
  )
}
