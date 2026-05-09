import { Header } from "../../components/Header";

export default function DepositsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
    </>
  );
}
