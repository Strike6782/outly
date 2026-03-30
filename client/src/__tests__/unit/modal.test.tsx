import { render, screen, fireEvent } from "@testing-library/react";
import Modal from "@/components/Modal";

describe("Modal component", () => {
  const onClose = jest.fn();

  beforeEach(() => {
    onClose.mockClear();
    document.body.style.overflow = "";
  });

  // --- Rendering ---

  it("renders nothing when isOpen is false", () => {
    const { container } = render(
      <Modal isOpen={false} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders children when isOpen is true", () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Modal content</p>
      </Modal>,
    );
    expect(screen.getByText("Modal content")).toBeInTheDocument();
  });

  // --- Center variant (default) ---

  it("renders as centered card by default", () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Center modal</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("max-w-[480px]");
    expect(dialog).toHaveClass("rounded-xl");
  });

  // --- Bottom-sheet variant ---

  it("renders as bottom-sheet when variant is bottom-sheet", () => {
    render(
      <Modal isOpen={true} onClose={onClose} variant="bottom-sheet">
        <p>Bottom sheet</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("rounded-t-2xl");
    expect(dialog).toHaveClass("inset-x-0");
    expect(dialog).toHaveClass("bottom-0");
  });

  // --- Dropdown variant ---

  it("renders as dropdown when variant is dropdown", () => {
    render(
      <Modal isOpen={true} onClose={onClose} variant="dropdown">
        <p>Dropdown content</p>
      </Modal>,
    );
    expect(screen.getByText("Dropdown content")).toBeInTheDocument();
    // Dropdown renders without backdrop, as a positioned absolute div
    const content = screen.getByText("Dropdown content");
    // Walk up to find the outermost dropdown container
    const dropdownContainer = content.closest(".w-\\[360px\\]");
    expect(dropdownContainer).toBeTruthy();
  });

  // --- Close behavior ---

  it("calls onClose when backdrop is clicked (center variant)", () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    // Backdrop is the first fixed element with bg-black/40
    const backdrop = document.querySelector("[aria-hidden='true']");
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when close button is clicked", () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    const closeBtn = screen.getByLabelText("Close");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not render close button when showCloseButton is false", () => {
    render(
      <Modal isOpen={true} onClose={onClose} showCloseButton={false}>
        <p>No close btn</p>
      </Modal>,
    );
    expect(screen.queryByLabelText("Close")).not.toBeInTheDocument();
  });

  // --- Body scroll lock ---

  it("locks body scroll when open", () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("restores body scroll when closed", () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <Modal isOpen={false} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("");
  });

  // --- Accessibility ---

  it("has role=dialog and aria-modal=true for center variant", () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Accessible modal</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  // --- Custom className ---

  it("applies custom className to the modal", () => {
    render(
      <Modal isOpen={true} onClose={onClose} className="my-custom-class">
        <p>Styled</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("my-custom-class");
  });
});
