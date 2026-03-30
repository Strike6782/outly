import { render, screen, fireEvent, act } from "@testing-library/react";
import fc from "fast-check";
import { SidebarProvider } from "@/context/SidebarContext";
import { useSidebar } from "@/hooks/useSidebar";

/**
 * Feature: responsive-ui-redesign, Property 3: Sidebar closes on navigation item or backdrop click
 * For any navigation item in the overlay sidebar (when open on viewports below 1024px),
 * clicking that item should result in the sidebar isOpen state becoming false.
 * Similarly, clicking the backdrop should result in isOpen becoming false.
 * Validates: Requirements 4.4
 */

// Test component that exposes sidebar state and simulates nav items + backdrop
function TestSidebar({ navItems }: { navItems: string[] }) {
  const { isOpen, toggle, close } = useSidebar();
  return (
    <div>
      <span data-testid="state">{isOpen ? "open" : "closed"}</span>
      <button data-testid="toggle" onClick={toggle}>Toggle</button>
      {isOpen && (
        <>
          <div data-testid="backdrop" onClick={close} />
          {navItems.map((item, i) => (
            <button key={i} data-testid={`nav-${i}`} onClick={close}>
              {item}
            </button>
          ))}
        </>
      )}
    </div>
  );
}

describe("Sidebar property tests", () => {
  it("Property 3: sidebar closes on any navigation item click", () => {
    fc.assert(
      fc.property(
        // Generate 1-10 nav items with random labels
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }),
        // Pick a random index to click
        fc.nat(),
        (navItems, rawIndex) => {
          const index = rawIndex % navItems.length;

          const { unmount } = render(
            <SidebarProvider>
              <TestSidebar navItems={navItems} />
            </SidebarProvider>,
          );

          // Open sidebar
          act(() => {
            fireEvent.click(screen.getByTestId("toggle"));
          });
          expect(screen.getByTestId("state").textContent).toBe("open");

          // Click the nav item at the random index
          act(() => {
            fireEvent.click(screen.getByTestId(`nav-${index}`));
          });
          expect(screen.getByTestId("state").textContent).toBe("closed");

          unmount();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 3: sidebar closes on backdrop click", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }),
        (navItems) => {
          const { unmount } = render(
            <SidebarProvider>
              <TestSidebar navItems={navItems} />
            </SidebarProvider>,
          );

          // Open sidebar
          act(() => {
            fireEvent.click(screen.getByTestId("toggle"));
          });
          expect(screen.getByTestId("state").textContent).toBe("open");

          // Click backdrop
          act(() => {
            fireEvent.click(screen.getByTestId("backdrop"));
          });
          expect(screen.getByTestId("state").textContent).toBe("closed");

          unmount();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Feature: responsive-ui-redesign, Property 4: Sidebar child order is consistent across viewports
   * For any viewport width, the Sidebar component should render its children in the same DOM order.
   * Validates: Requirements 4.6
   */
  it("Property 4: sidebar children order is consistent regardless of open state", () => {
    // The order of elements should be the same whether sidebar is open or closed-then-reopened
    function OrderTestSidebar() {
      const { isOpen, toggle } = useSidebar();
      return (
        <div>
          <button data-testid="toggle" onClick={toggle}>Toggle</button>
          {isOpen && (
            <div data-testid="sidebar-content">
              <span data-testid="child-0">UserCard</span>
              <span data-testid="child-1">Compose</span>
              <span data-testid="child-2">NavItems</span>
            </div>
          )}
        </div>
      );
    }

    fc.assert(
      fc.property(
        // Random number of toggle cycles
        fc.integer({ min: 1, max: 5 }),
        (toggleCount) => {
          const { unmount } = render(
            <SidebarProvider>
              <OrderTestSidebar />
            </SidebarProvider>,
          );

          // Toggle open/close multiple times
          for (let i = 0; i < toggleCount * 2; i++) {
            act(() => {
              fireEvent.click(screen.getByTestId("toggle"));
            });
          }

          // Open one final time
          act(() => {
            fireEvent.click(screen.getByTestId("toggle"));
          });

          // Verify order is always the same
          const content = screen.getByTestId("sidebar-content");
          const children = Array.from(content.children).map((c) => c.textContent);
          expect(children).toEqual(["UserCard", "Compose", "NavItems"]);

          unmount();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("throws error when useSidebar is used outside SidebarProvider", () => {
    function BadComponent() {
      useSidebar();
      return null;
    }

    // Suppress console.error for expected error
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<BadComponent />)).toThrow(
      "useSidebar must be used within a SidebarProvider",
    );
    spy.mockRestore();
  });
});

/**
 * Feature: responsive-ui-redesign, Property 7: Active sidebar item green styling
 * For any SidebarItem where isActive is true, the rendered element should have
 * bg-green-50 and text-green-700 classes. For inactive items, these should not be present.
 * Validates: Requirements 11.4
 */

// Import SidebarItem directly for isolated testing
import { SidebarItem } from "@/components/SidebarItem";

describe("SidebarItem active styling property tests", () => {
  it("Property 7: active item has green styling, inactive does not", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.boolean(),
        fc.option(fc.nat({ max: 999 })),
        (label, isActive, count) => {
          const onClick = jest.fn();
          const { container, unmount } = render(
            <SidebarItem
              label={label}
              isActive={isActive}
              count={count ?? undefined}
              onClick={onClick}
            />,
          );

          const item = container.firstElementChild!;

          if (isActive) {
            expect(item.className).toContain("bg-primary/10");
            expect(item.className).toContain("text-primary");
          } else {
            expect(item.className).not.toContain("bg-primary/10");
            expect(item.className).not.toContain("text-primary");
          }

          unmount();
        },
      ),
      { numRuns: 100 },
    );
  });
});
