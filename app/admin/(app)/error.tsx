'use client';

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="a-empty">
      <p>Не удалось выполнить действие. Попробуйте ещё раз.</p>
      <button className="a-btn a-btn--primary" onClick={reset}>Повторить</button>
    </div>
  );
}
