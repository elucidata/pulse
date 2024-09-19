import htm from "htm"
import { h } from "./runtime"

// Bind 'htm' to our 'h' function
export const html = htm.bind(h)
