// Dropdowns render on <body> above the modal (z-index 10001 in index.css). Containing them inside a
// modal made them clip at its edge; see config/popup.js for why they never flip upward.
export const getPopupContainer = () => document.body;
