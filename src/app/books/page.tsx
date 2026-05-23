"use client";
import { DashboardShell } from "@/components/DashboardShell";
import { BooksView } from "@/components/books/BooksView";
export default function Page() {
  return <DashboardShell>{({ data, update }) => <BooksView data={data} update={update} />}</DashboardShell>;
}
