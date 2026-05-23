"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Plus, Trash2, BookMarked, Search } from "lucide-react";
import { DashboardData, BookEntry } from "@/types/dashboard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { id, today as todayStr } from "@/lib/utils";

interface Props {
  data: DashboardData;
  update: (fn: (d: DashboardData) => DashboardData) => void;
}

export function BooksView({ data, update }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ title: "", author: "", type: "book" as BookEntry["type"], status: "reading" as BookEntry["status"], startDate: todayStr(), finishedDate: "", rating: 0, notes: "" });
  const [searchTitle, setSearchTitle] = useState("");

  const reading = data.books.filter((b) => b.status === "reading");
  const finished = data.books.filter((b) => b.status === "finished");
  const devotionals = data.books.filter((b) => b.type === "devotional");

  const searchCover = async () => {
    if (!searchTitle.trim()) return;
    const q = encodeURIComponent(searchTitle.trim());
    const url = `https://openlibrary.org/search.json?title=${q}&fields=title,author_name,cover_i&limit=1`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      const doc = json.docs?.[0];
      if (doc) {
        setForm((f) => ({
          ...f,
          title: doc.title ?? f.title,
          author: doc.author_name?.[0] ?? f.author,
          coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : undefined,
        } as typeof f & { coverUrl?: string }));
      }
    } catch {}
  };

  const addBook = () => {
    if (!form.title.trim()) return;
    update((d) => ({ ...d, books: [...d.books, { ...form, id: id() } as BookEntry] }));
    setForm({ title: "", author: "", type: "book", status: "reading", startDate: todayStr(), finishedDate: "", rating: 0, notes: "" });
    setAddOpen(false);
  };

  const deleteBook = (bid: string) => {
    update((d) => ({ ...d, books: d.books.filter((b) => b.id !== bid) }));
  };

  const updateStatus = (bid: string, status: BookEntry["status"]) => {
    update((d) => ({ ...d, books: d.books.map((b) => b.id === bid ? { ...b, status, finishedDate: status === "finished" ? todayStr() : b.finishedDate } : b) }));
  };

  const BookCard = ({ book }: { book: BookEntry }) => (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-cream-dark group">
      {book.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={book.coverUrl} alt="" className="w-10 h-14 object-cover rounded shadow-soft flex-shrink-0" />
      ) : (
        <div className="w-10 h-14 rounded flex-shrink-0 flex items-center justify-center" style={{ background: "#cfbb9f" }}>
          <BookMarked size={16} className="text-brown" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-brown leading-tight">{book.title}</p>
        <p className="text-xs text-sand-dark">{book.author}</p>
        {book.startDate && <p className="text-xs text-sand-dark">Started {format(parseISO(book.startDate), "MMM d, yyyy")}</p>}
        {book.finishedDate && <p className="text-xs text-sage">Finished {format(parseISO(book.finishedDate), "MMM d, yyyy")}</p>}
        {book.notes && <p className="text-xs text-brown italic mt-1">{book.notes}</p>}
        {book.status === "reading" && (
          <button onClick={() => updateStatus(book.id, "finished")} className="text-xs text-terracotta hover:underline mt-1">
            Mark as finished ✓
          </button>
        )}
      </div>
      <button onClick={() => deleteBook(book.id)} className="opacity-0 group-hover:opacity-100 text-sand hover:text-rose flex-shrink-0">
        <Trash2 size={13} />
      </button>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-4xl text-brown">Books & Devotionals</h1>
          <p className="text-sand-dark mt-1">What&apos;s nourishing your mind and spirit 📖</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={14} className="mr-1.5 inline" /> Add Book
        </Button>
      </div>

      {reading.length > 0 && (
        <Card title="Currently Reading">
          <div className="space-y-3 mt-2">
            {reading.map((b) => <BookCard key={b.id} book={b} />)}
          </div>
        </Card>
      )}

      {devotionals.filter((b) => b.status !== "finished").length > 0 && (
        <Card title="Devotional / Bible Study 🙏">
          <div className="space-y-3 mt-2">
            {devotionals.filter((b) => b.status !== "finished").map((b) => <BookCard key={b.id} book={b} />)}
          </div>
        </Card>
      )}

      {finished.length > 0 && (
        <Card title="Finished This Quarter">
          <div className="space-y-3 mt-2">
            {finished.slice(-10).reverse().map((b) => <BookCard key={b.id} book={b} />)}
          </div>
        </Card>
      )}

      {data.books.length === 0 && (
        <Card>
          <p className="text-sand-dark text-sm text-center py-6">No books yet. What are you reading? 📚</p>
        </Card>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Book">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input type="text" placeholder="Search by title to auto-fill…" value={searchTitle} onChange={(e) => setSearchTitle(e.target.value)} className="flex-1" />
            <Button size="sm" variant="secondary" onClick={searchCover}><Search size={14} /></Button>
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Title</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Author</label>
            <input type="text" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-brown block mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as BookEntry["type"] })}>
                <option value="book">Book</option>
                <option value="devotional">Devotional</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-brown block mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as BookEntry["status"] })}>
                <option value="reading">Currently Reading</option>
                <option value="finished">Finished</option>
                <option value="want-to-read">Want to Read</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-brown block mb-1">Notes</label>
            <textarea rows={2} placeholder="Thoughts, quotes you love…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addBook}>Add Book</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
