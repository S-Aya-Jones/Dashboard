"use client";

import { useState, useEffect, useRef } from "react";
import { format, parseISO } from "date-fns";
import { Search, Trash2, BookMarked, ChevronDown } from "lucide-react";
import { DashboardData, BookEntry } from "@/types/dashboard";
import { Card } from "@/components/ui/Card";
import { id, today as todayStr } from "@/lib/utils";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

interface SearchResult {
  key: string;
  title: string;
  author: string;
  coverId?: number;
}

const SHELF_OPTIONS = [
  { value: "reading",      label: "Currently Reading" },
  { value: "want-to-read", label: "Want to Read" },
  { value: "devotional",   label: "Devotional" },
  { value: "finished",     label: "Mark as Finished" },
];

function isThisQuarter(dateStr?: string): boolean {
  if (!dateStr) return false;
  try {
    const d = parseISO(dateStr);
    const now = new Date();
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const qEnd   = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);
    return d >= qStart && d <= qEnd;
  } catch { return false; }
}

export function BooksView({ data, update }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const books = data.books;
  const currentlyReading    = books.filter((b) => b.status === "reading" && b.type !== "devotional");
  const wantToRead          = books.filter((b) => b.status === "want-to-read");
  const devotional          = books.filter((b) => b.type === "devotional");
  const finishedThisQuarter = books.filter((b) => b.status === "finished" && isThisQuarter(b.finishedDate));

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query.trim()) { setResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query.trim())}&fields=key,title,author_name,cover_i&limit=10`;
        const res  = await fetch(url);
        const json = await res.json();
        setResults(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (json.docs ?? []).map((doc: any) => ({
            key:     doc.key    ?? "",
            title:   doc.title  ?? "Unknown Title",
            author:  doc.author_name?.[0] ?? "Unknown Author",
            coverId: doc.cover_i,
          }))
        );
      } catch { setResults([]); }
      finally  { setSearching(false); }
    }, 500);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query]);

  const addToShelf = (result: SearchResult, shelf: string) => {
    const item: BookEntry = {
      id:          id(),
      title:       result.title,
      author:      result.author,
      coverUrl:    result.coverId
        ? `https://covers.openlibrary.org/b/id/${result.coverId}-M.jpg`
        : undefined,
      status:      shelf === "want-to-read" ? "want-to-read"
                 : shelf === "finished"     ? "finished"
                 : "reading",
      type:        shelf === "devotional" ? "devotional" : "book",
      startDate:   shelf === "reading"   ? todayStr() : undefined,
      finishedDate: shelf === "finished" ? todayStr() : undefined,
    };
    update((d) => ({ ...d, books: [...d.books, item] }));
    setPendingKey(null);
    setResults([]);
    setQuery("");
  };

  const moveBook = (bid: string, shelf: string) => {
    update((d) => ({
      ...d,
      books: d.books.map((b) => {
        if (b.id !== bid) return b;
        if (shelf === "devotional") return { ...b, type: "devotional" as const, status: "reading" as const };
        if (shelf === "finished")   return { ...b, status: "finished" as const, finishedDate: b.finishedDate || todayStr() };
        return { ...b, status: shelf as BookEntry["status"], type: "book" as const };
      }),
    }));
  };

  const deleteBook = (bid: string) =>
    update((d) => ({ ...d, books: d.books.filter((b) => b.id !== bid) }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-serif text-4xl text-brown">Books &amp; Devotionals</h1>
        <p className="text-sand-dark mt-1">What&apos;s nourishing your mind and spirit 📖</p>
      </div>

      {/* Search */}
      <div className="card p-4 space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sand-dark pointer-events-none" />
          <input
            type="text"
            placeholder="Search Open Library to add a book…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPendingKey(null); }}
            className="pl-8"
          />
        </div>

        {searching && (
          <p className="text-xs text-sand-dark text-center py-2 animate-pulse">Searching Open Library…</p>
        )}

        {results.length > 0 && (
          <div className="space-y-0.5 max-h-[380px] overflow-y-auto">
            {results.map((r) => (
              <SearchRow
                key={r.key}
                result={r}
                isPending={pendingKey === r.key}
                onToggle={() => setPendingKey(pendingKey === r.key ? null : r.key)}
                onShelf={(shelf) => addToShelf(r, shelf)}
              />
            ))}
          </div>
        )}
      </div>

      <BookSection title="Currently Reading"                books={currentlyReading}    onMove={moveBook} onDelete={deleteBook} />
      <BookSection title="Want to Read"                     books={wantToRead}           onMove={moveBook} onDelete={deleteBook} />
      <BookSection title="Devotional / Bible Study 🙏"     books={devotional}           onMove={moveBook} onDelete={deleteBook} />
      <BookSection
        title={`Finished This Quarter${finishedThisQuarter.length ? ` · ${finishedThisQuarter.length}` : ""}`}
        books={finishedThisQuarter}
        onMove={moveBook}
        onDelete={deleteBook}
        showFinishedDate
      />

      {books.length === 0 && !query && (
        <p className="text-sand-dark text-sm text-center py-8">No books yet — search above to add one 📚</p>
      )}
    </div>
  );
}

/* ── Search result row ── */
function SearchRow({
  result,
  isPending,
  onToggle,
  onShelf,
}: {
  result: SearchResult;
  isPending: boolean;
  onToggle: () => void;
  onShelf: (shelf: string) => void;
}) {
  return (
    <div className="flex items-start gap-3 p-2 rounded-xl hover:bg-cream-darker transition-colors">
      {result.coverId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://covers.openlibrary.org/b/id/${result.coverId}-S.jpg`}
          alt=""
          className="w-9 h-12 object-cover rounded shadow-soft flex-shrink-0 mt-0.5"
        />
      ) : (
        <div className="w-9 h-12 rounded flex-shrink-0 flex items-center justify-center bg-sand/30 mt-0.5">
          <BookMarked size={12} className="text-brown" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-brown leading-tight">{result.title}</p>
        <p className="text-xs text-sand-dark mb-1.5">{result.author}</p>

        {isPending ? (
          <div className="flex gap-1 flex-wrap">
            {SHELF_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onShelf(opt.value)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-terracotta hover:bg-terracotta/80 transition-colors"
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={onToggle}
            className="text-xs px-2.5 py-1 rounded-lg bg-cream-darker text-brown hover:bg-sand/40 transition-colors inline-flex items-center gap-1"
          >
            Add to shelf <ChevronDown size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Section wrapper ── */
function BookSection({
  title,
  books,
  onMove,
  onDelete,
  showFinishedDate = false,
}: {
  title: string;
  books: BookEntry[];
  onMove: (id: string, shelf: string) => void;
  onDelete: (id: string) => void;
  showFinishedDate?: boolean;
}) {
  if (books.length === 0) return null;
  return (
    <Card title={title}>
      <div className="space-y-2 mt-2">
        {books.map((b) => (
          <BookCard key={b.id} book={b} onMove={onMove} onDelete={onDelete} showFinishedDate={showFinishedDate} />
        ))}
      </div>
    </Card>
  );
}

/* ── Book card ── */
function BookCard({
  book,
  onMove,
  onDelete,
  showFinishedDate,
}: {
  book: BookEntry;
  onMove: (id: string, shelf: string) => void;
  onDelete: (id: string) => void;
  showFinishedDate: boolean;
}) {
  const [moving, setMoving] = useState(false);

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-cream-dark group">
      {book.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={book.coverUrl} alt="" className="w-10 h-14 object-cover rounded shadow-soft flex-shrink-0" />
      ) : (
        <div className="w-10 h-14 rounded flex-shrink-0 flex items-center justify-center" style={{ background: "rgba(124,92,252,0.3)" }}>
          <BookMarked size={16} className="text-brown" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-brown leading-tight">{book.title}</p>
        <p className="text-xs text-sand-dark">{book.author}</p>

        {showFinishedDate && book.finishedDate && (
          <p className="text-xs text-sage">Finished {format(parseISO(book.finishedDate), "MMM d, yyyy")}</p>
        )}
        {!showFinishedDate && book.startDate && (
          <p className="text-xs text-sand-dark">Started {format(parseISO(book.startDate), "MMM d, yyyy")}</p>
        )}
        {book.notes && (
          <p className="text-xs text-brown italic mt-0.5 leading-snug">{book.notes}</p>
        )}

        {moving ? (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {SHELF_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onMove(book.id, opt.value); setMoving(false); }}
                className="text-[11px] px-2 py-0.5 rounded-full bg-terracotta/10 text-terracotta hover:bg-terracotta transition-colors"
              >
                {opt.label}
              </button>
            ))}
            <button
              onClick={() => setMoving(false)}
              className="text-[11px] px-2 py-0.5 rounded-full bg-cream-darker text-sand-dark"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setMoving(true)}
            className="text-xs text-sand-dark hover:text-terracotta transition-colors mt-1 opacity-0 group-hover:opacity-100"
          >
            Move to shelf ↗
          </button>
        )}
      </div>

      <button
        onClick={() => onDelete(book.id)}
        className="opacity-0 group-hover:opacity-100 text-sand hover:text-rose flex-shrink-0 transition-all pt-0.5"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
