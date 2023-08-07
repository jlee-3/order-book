"use client";

import OrderBook from "../components/order-book";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <OrderBook />
    </main>
  );
}
