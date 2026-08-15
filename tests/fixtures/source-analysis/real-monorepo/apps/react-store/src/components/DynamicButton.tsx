type DynamicButtonProps = {
  buttonId: string;
  label: string;
};

export function DynamicButton({ buttonId, label }: DynamicButtonProps) {
  return (
    <button id={buttonId} aria-label={label} type="button">
      Pay
    </button>
  );
}
