import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

/** Markdown styles for assistant replies (no typography plugin in this app, so elements are styled here). */
const components: Components = {
  h1: ({ children }) => <h3 className="mb-2 mt-4 text-lg font-semibold text-slate-900 first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-2 mt-4 text-base font-semibold text-slate-900 first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-1.5 mt-3 text-sm font-semibold text-slate-900 first:mt-0">{children}</h4>,
  p: ({ children }) => <p className="my-2 leading-relaxed first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  a: ({ children, href }) => (
    <a href={href} className="text-blue-600 underline underline-offset-2 hover:text-blue-800" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-slate-300 pl-3 text-slate-600">{children}</blockquote>
  ),
  code: ({ children, className }) =>
    className ? (
      <code className={cn("block overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100", className)}>
        {children}
      </code>
    ) : (
      <code className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em] text-slate-800">{children}</code>
    ),
  pre: ({ children }) => <pre className="my-2">{children}</pre>,
  hr: () => <hr className="my-4 border-slate-200" />,
  table: ({ children }) => (
    <div className="my-3 max-w-full overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-50 text-slate-600">{children}</thead>,
  th: ({ children }) => <th className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-slate-100 px-3 py-1.5 align-top text-slate-800">{children}</td>,
}

export function AssistantMarkdown({ text }: { text: string }) {
  return (
    <div className="text-sm text-slate-800 [overflow-wrap:anywhere]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  )
}
