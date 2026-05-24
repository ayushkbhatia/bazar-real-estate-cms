"use client";

import { ListingCard, type ListingCardProps } from "@/components/brand/listing-card";
import { useSavedIds } from "./saved-ids-provider";

// Wraps ListingCard so the heart icon reflects the signed-in user's saved
// properties without forcing the parent route to render dynamically. The
// listing pages render anonymously (ISR-eligible); this component fetches the
// saved set on the client and re-mounts the card once it arrives so the
// underlying SaveButton picks up the correct initial state.
export function ListingCardSaveable(props: ListingCardProps) {
  const { ids, isAuthed, loaded } = useSavedIds();
  const initialSaved = props.propertyId ? ids.has(props.propertyId) : false;

  return (
    <ListingCard
      {...props}
      key={loaded ? "loaded" : "pending"}
      initialSaved={initialSaved}
      isAuthed={isAuthed}
    />
  );
}
