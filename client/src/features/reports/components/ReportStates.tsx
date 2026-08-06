export const ReportsLoadingState = () => <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading reports...</div>
export const ReportsErrorState = ({ message }: { message: string }) => <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm font-medium text-rose-800">{message}</div>
export const ReportsEmptyState = () => <div className="rounded-lg border border-slate-200 bg-white p-8 text-sm leading-6 text-slate-600">No synced logs yet. When the extension starts uploading redacted records, they will appear here.</div>
