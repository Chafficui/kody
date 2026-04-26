import { el, on } from "../utils/dom.js";
import { sanitizeText } from "../utils/sanitize.js";

export interface TicketFormOptions {
  requiredFields: string[];
  onSubmit: (data: Record<string, string>) => void;
  onCancel: () => void;
}

export interface TicketForm {
  element: HTMLDivElement;
  setSubmitting(submitting: boolean): void;
  setError(message: string | null): void;
  setSuccess(message: string): void;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function inputTypeFor(field: string): string {
  if (field === "email") return "email";
  return "text";
}

export function createTicketForm(options: TicketFormOptions): TicketForm {
  const { requiredFields, onSubmit, onCancel } = options;

  const wrapper = el("div", { class: "kody-ticket-form" });

  // Heading
  const heading = el("div", { class: "kody-ticket-form-heading" }, ["Create a Support Ticket"]);
  wrapper.appendChild(heading);

  // Build form element
  const form = el("form", { class: "kody-ticket-form-body" });

  // Track inputs/textareas keyed by field name
  const inputs = new Map<string, HTMLInputElement | HTMLTextAreaElement>();

  for (const field of requiredFields) {
    const fieldId = `kody-ticket-${field}`;
    const label = el("label", { for: fieldId, class: "kody-ticket-label" }, [capitalize(field)]);
    form.appendChild(label);

    if (field === "description") {
      const textarea = el("textarea", {
        id: fieldId,
        name: field,
        class: "kody-ticket-input",
        required: "",
        rows: "4",
      });
      inputs.set(field, textarea);
      form.appendChild(textarea);
    } else {
      const input = el("input", {
        id: fieldId,
        name: field,
        type: inputTypeFor(field),
        class: "kody-ticket-input",
        required: "",
      });
      inputs.set(field, input);
      form.appendChild(input);
    }
  }

  // Error container (hidden initially)
  const errorContainer = el("div", { class: "kody-ticket-error" });
  errorContainer.style.display = "none";
  form.appendChild(errorContainer);

  // Buttons row
  const buttonsRow = el("div", { class: "kody-ticket-buttons" });

  const submitButton = el("button", { type: "submit", class: "kody-ticket-submit" }, [
    "Submit Ticket",
  ]);
  buttonsRow.appendChild(submitButton);

  const cancelButton = el("button", { type: "button", class: "kody-ticket-cancel" }, [
    "Back to chat",
  ]);
  buttonsRow.appendChild(cancelButton);

  form.appendChild(buttonsRow);
  wrapper.appendChild(form);

  // --- Event handlers ---

  on(cancelButton, "click", () => {
    onCancel();
  });

  on(form, "submit", (e: Event) => {
    e.preventDefault();

    // Validate all fields non-empty
    const data: Record<string, string> = {};
    for (const field of requiredFields) {
      const input = inputs.get(field)!;
      const value = sanitizeText(input.value);
      if (value.length === 0) {
        ticketForm.setError(`${capitalize(field)} is required.`);
        input.focus();
        return;
      }
      data[field] = value;
    }

    ticketForm.setError(null);
    onSubmit(data);
  });

  // --- Public interface ---

  const ticketForm: TicketForm = {
    element: wrapper,

    setSubmitting(submitting: boolean) {
      submitButton.disabled = submitting;
      // Clear existing children and set new text
      while (submitButton.firstChild) {
        submitButton.removeChild(submitButton.firstChild);
      }
      submitButton.appendChild(
        document.createTextNode(submitting ? "Submitting..." : "Submit Ticket"),
      );
    },

    setError(message: string | null) {
      if (message === null) {
        errorContainer.style.display = "none";
        while (errorContainer.firstChild) {
          errorContainer.removeChild(errorContainer.firstChild);
        }
      } else {
        while (errorContainer.firstChild) {
          errorContainer.removeChild(errorContainer.firstChild);
        }
        errorContainer.appendChild(document.createTextNode(message));
        errorContainer.style.display = "";
      }
    },

    setSuccess(message: string) {
      // Replace entire wrapper content with success view
      while (wrapper.firstChild) {
        wrapper.removeChild(wrapper.firstChild);
      }

      const successContainer = el("div", {
        class: "kody-ticket-success",
      });

      const successMessage = el("div", { class: "kody-ticket-success-message" }, [message]);
      successContainer.appendChild(successMessage);

      const backButton = el("button", { type: "button", class: "kody-ticket-cancel" }, [
        "Back to chat",
      ]);
      on(backButton, "click", () => {
        onCancel();
      });
      successContainer.appendChild(backButton);

      wrapper.appendChild(successContainer);
    },
  };

  return ticketForm;
}
