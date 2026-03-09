import type { WorkItem } from "../functions/types";

type WorkItemSectionProps = {
  title: string;
  emptyText: string;
  items: WorkItem[];
};

export function WorkItemSection({ title, emptyText, items }: WorkItemSectionProps) {
  return (
    <>
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p>{emptyText}</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <a href={item.url} target="_blank" rel="noreferrer">
                {item.id} - {item.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
