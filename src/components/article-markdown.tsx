import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders article markdown with site typography (no CSS plugin needed). */
export function ArticleMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h2: ({ children }) => (
          <h2 className="mt-10 text-2xl font-bold tracking-tight text-zinc-900">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mt-8 text-lg font-semibold text-zinc-900">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="mt-4 leading-relaxed text-zinc-700">{children}</p>
        ),
        a: ({ href, children }) => {
          const url = href ?? "#";
          if (url.startsWith("/")) {
            return (
              <Link href={url} className="font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800">
                {children}
              </Link>
            );
          }
          return (
            <a
              href={url}
              className="font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800"
              rel="noopener noreferrer"
              target="_blank"
            >
              {children}
            </a>
          );
        },
        ul: ({ children }) => (
          <ul className="mt-4 list-disc space-y-2 pl-6 text-zinc-700">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mt-4 list-decimal space-y-2 pl-6 text-zinc-700">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-zinc-900">{children}</strong>,
        blockquote: ({ children }) => (
          <blockquote className="mt-4 border-l-4 border-teal-200 pl-4 text-zinc-600 italic">
            {children}
          </blockquote>
        ),
        code: ({ children }) => (
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-[13px] text-zinc-800">
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="mt-4 overflow-x-auto rounded-xl bg-zinc-900 p-4 text-sm text-zinc-100">
            {children}
          </pre>
        ),
        table: ({ children }) => (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border-b border-zinc-300 px-3 py-2 text-left font-semibold text-zinc-900">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border-b border-zinc-100 px-3 py-2 text-zinc-700">{children}</td>
        ),
        hr: () => <hr className="mt-8 border-zinc-200" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
