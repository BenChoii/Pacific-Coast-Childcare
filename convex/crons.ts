import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Tuition auto-invoicing: on the 1st at 9:00 PT (16:00 UTC) generate each
// family's monthly invoice (tuition + plans + unbilled extras) for every
// facility that has autoInvoice enabled.
crons.monthly('generate tuition invoices', { day: 1, hourUTC: 16, minuteUTC: 0 }, internal.invoices.generateMonthly, {})

export default crons
