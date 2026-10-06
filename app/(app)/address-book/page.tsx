import type { Metadata } from "next";
import { AddressBookPage } from "@/components/address-book/address-book-page";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Address book",
  description: "Wallet addresses saved on your Sandia account.",
  path: "/address-book",
  index: false,
});

export default function AddressBookRoute() {
  return <AddressBookPage />;
}
