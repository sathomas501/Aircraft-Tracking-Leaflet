// lib/utils/dragmearound.js

export function initDraggablePanels() {
  // Function to make an element draggable
  function makeDraggable(element) {
    let isDragging = false;
    let offsetX, offsetY;

    // Handle mousedown to start dragging
    element.addEventListener('mousedown', function (e) {
      // Only start dragging if clicking on the drag handle or the panel itself (not buttons/links)
      if (e.target.closest('.drag-handle') || e.target === element) {
        isDragging = true;

        // Get the initial mouse position relative to the element
        const rect = element.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        // Add a dragging class for visual feedback
        element.classList.add('dragging');

        // Prevent text selection during drag
        e.preventDefault();
      }
    });

    // Handle mousemove to actually move the element
    document.addEventListener('mousemove', function (e) {
      if (isDragging) {
        // Calculate new position
        const x = e.clientX - offsetX;
        const y = e.clientY - offsetY;

        // Apply new position, keeping element within viewport
        element.style.left =
          Math.max(0, Math.min(window.innerWidth - element.offsetWidth, x)) +
          'px';
        element.style.top =
          Math.max(0, Math.min(window.innerHeight - element.offsetHeight, y)) +
          'px';

        // Switch from absolute positioning to fixed positioning for correct behavior
        element.style.position = 'fixed';
      }
    });

    // Handle mouseup to stop dragging
    document.addEventListener('mouseup', function () {
      if (isDragging) {
        isDragging = false;
        element.classList.remove('dragging');
      }
    });
  }

  // Set up a mutation observer to watch for new draggable panels
  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) {
            // Element node
            // Check if it's a draggable panel
            if (node.classList && node.classList.contains('draggable-panel')) {
              makeDraggable(node);
            }

            // Also check children
            const draggablePanels = node.querySelectorAll('.draggable-panel');
            draggablePanels.forEach(makeDraggable);
          }
        });
      }
    });
  });

  // Start observing the document
  observer.observe(document.body, { childList: true, subtree: true });

  // Also handle any existing draggable panels
  document.querySelectorAll('.draggable-panel').forEach(makeDraggable);
}
