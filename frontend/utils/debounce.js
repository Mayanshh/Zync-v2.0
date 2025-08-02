
// Utility functions for performance optimization
export function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

export function throttle(func, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

export function memoize(func, getKey = (...args) => JSON.stringify(args)) {
  const cache = new Map();
  return function (...args) {
    const key = getKey(...args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = func.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

// Virtual scrolling for large lists
export class VirtualScroller {
  constructor(container, itemHeight, renderItem) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.renderItem = renderItem;
    this.items = [];
    this.visibleStart = 0;
    this.visibleEnd = 0;
    this.scrollTop = 0;
    
    this.setupScrollListener();
  }

  setItems(items) {
    this.items = items;
    this.updateVisible();
  }

  setupScrollListener() {
    this.container.addEventListener('scroll', throttle(() => {
      this.scrollTop = this.container.scrollTop;
      this.updateVisible();
    }, 16)); // ~60fps
  }

  updateVisible() {
    const containerHeight = this.container.clientHeight;
    const totalHeight = this.items.length * this.itemHeight;
    
    this.visibleStart = Math.floor(this.scrollTop / this.itemHeight);
    this.visibleEnd = Math.min(
      this.items.length,
      this.visibleStart + Math.ceil(containerHeight / this.itemHeight) + 2
    );

    this.render();
  }

  render() {
    const fragment = document.createDocumentFragment();
    
    // Add spacer for items above visible area
    const topSpacer = document.createElement('div');
    topSpacer.style.height = `${this.visibleStart * this.itemHeight}px`;
    fragment.appendChild(topSpacer);

    // Render visible items
    for (let i = this.visibleStart; i < this.visibleEnd; i++) {
      const item = this.renderItem(this.items[i], i);
      fragment.appendChild(item);
    }

    // Add spacer for items below visible area
    const bottomSpacer = document.createElement('div');
    bottomSpacer.style.height = `${(this.items.length - this.visibleEnd) * this.itemHeight}px`;
    fragment.appendChild(bottomSpacer);

    this.container.innerHTML = '';
    this.container.appendChild(fragment);
  }
}
