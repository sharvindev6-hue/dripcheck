import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** The outfit is Today now; keep the old URL working. */
export default function OutfitRedirect() {
  redirect('/')
}
