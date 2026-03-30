import { render } from "@testing-library/react";
import fc from "fast-check";
import { UserCard } from "@/components/UserCard";

/**
 * Feature: responsive-ui-redesign, Property 6: UserCard text truncation
 * For any user name or email string that exceeds the UserCard container width,
 * the rendered text should be truncated with an ellipsis (the element should have
 * CSS overflow: hidden, text-overflow: ellipsis, and white-space: nowrap via Tailwind's truncate class).
 * Validates: Requirements 10.3
 */

// Mock next/image to avoid Next.js image optimization in tests
jest.mock("next/image", () => {
  const MockImage = (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  };
  MockImage.displayName = "MockImage";
  return { __esModule: true, default: MockImage };
});

describe("UserCard text truncation property tests", () => {
  it("Property 6: name and email elements always have truncate class", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.emailAddress(),
        fc.string({ minLength: 0, maxLength: 100 }),
        (name, email, avatarUrl) => {
          const { container, unmount } = render(
            <UserCard name={name} email={email} avatarUrl={avatarUrl} />,
          );

          // Find the text container div (has min-w-0)
          const textContainer = container.querySelector(".min-w-0");
          expect(textContainer).toBeTruthy();

          // Both p elements inside should have truncate class
          const paragraphs = textContainer!.querySelectorAll("p");
          expect(paragraphs.length).toBe(2);

          paragraphs.forEach((p) => {
            expect(p.className).toContain("truncate");
          });

          unmount();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 6: text container has min-w-0 for flex truncation", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.emailAddress(),
        (name, email) => {
          const { container, unmount } = render(
            <UserCard name={name} email={email} avatarUrl="" />,
          );

          const textContainer = container.querySelector(".min-w-0");
          expect(textContainer).toBeTruthy();

          unmount();
        },
      ),
      { numRuns: 100 },
    );
  });
});
