import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { formatNumber } from '../utils/format';

function itemLabel(item) {
  return `${item.name} (${item.itemCode})`;
}

export function ItemSelect({ id, items = [], value, onChange, invalid = false }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const skipValueSyncRef = useRef(false);
  const selected = items.find((item) => item.id === value);
  const normalizedQuery = query.trim().toLocaleLowerCase();

  const filteredItems = useMemo(
    () =>
      items.filter((item) =>
        [item.name, item.itemCode, item.category, item.location]
          .filter(Boolean)
          .some((field) => field.toLocaleLowerCase().includes(normalizedQuery))
      ),
    [items, normalizedQuery]
  );

  useEffect(() => {
    if (skipValueSyncRef.current) {
      skipValueSyncRef.current = false;
      return;
    }
    setQuery(selected ? itemLabel(selected) : '');
  }, [selected]);

  useEffect(() => {
    setActiveIndex(0);
  }, [normalizedQuery]);

  const choose = (item) => {
    onChange(item.id);
    setQuery(itemLabel(item));
    setOpen(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, filteredItems.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && open && filteredItems[activeIndex]) {
      event.preventDefault();
      choose(filteredItems[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="item-picker">
      <div className="input-icon-wrap">
        <Search size={15} />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-activedescendant={open && filteredItems[activeIndex] ? `${id}-option-${activeIndex}` : undefined}
          aria-invalid={invalid}
          autoComplete="off"
          className={`input ${invalid ? 'invalid' : ''}`}
          value={query}
          placeholder="Search by item name, code, category or location"
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (value) {
              skipValueSyncRef.current = true;
              onChange('');
            }
          }}
        />
      </div>
      {open && (
        <div className="item-picker-list" id={`${id}-listbox`} role="listbox" aria-label="Inventory items">
          {filteredItems.length ? (
            filteredItems.map((item, index) => (
              <button
                type="button"
                id={`${id}-option-${index}`}
                key={item.id}
                role="option"
                aria-selected={item.id === value}
                className={`item-picker-option ${activeIndex === index ? 'active' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(item)}
              >
                <span className="item-picker-copy">
                  <b>{item.name}</b>
                  <small>
                    {item.itemCode}
                    {item.category ? ` · ${item.category}` : ''}
                    {item.location ? ` · ${item.location}` : ''}
                  </small>
                </span>
                <span className="item-picker-stock">
                  {formatNumber(item.quantity)} {item.unit}
                  <small>available</small>
                </span>
              </button>
            ))
          ) : (
            <div className="item-picker-empty">No matching items.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default ItemSelect;
