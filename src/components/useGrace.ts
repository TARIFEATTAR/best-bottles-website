/**
 * Shared Grace context barrel.
 *
 * This provides access to the Grace context currently being handled by
 * GraceElevenLabsProvider. Components should always import from here 
 * to remain provider-agnostic.
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
