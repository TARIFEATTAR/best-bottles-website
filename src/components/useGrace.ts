/**
 * Shared Grace context barrel — re-exports from GraceContext.
 * Returns safe no-ops when GraceWidget handles the conversation directly.
 */

export {
    useGrace,
    type GraceStatus,
    type GraceAction,
    type GraceMessage,
    type ProductCard,
    type KitItem,
    type PanelMode,
} from "./GraceContext";
