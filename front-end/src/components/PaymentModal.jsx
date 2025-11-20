import React, { useState, useEffect } from "react";
import api from "../utils/api";

const Field = ({ label, required, children }) => (
  <label className="block">
    <span className="mb-1 block text-sm font-medium text-gray-700">
      {label} {required ? <span className="text-red-500">*</span> : null}
    </span>
    {children}
  </label>
);

const PaymentModal = ({
  isOpen,
  onClose,
  saleId,
  sale,
  customerName,
  defaultPaymentMethod = "cash",
  allowedPaymentMethods = ["cash", "cheque"], // Array of allowed methods: ["cash", "cheque"] or ["cash"] or ["cheque"]
  onPaymentSuccess,
}) => {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(defaultPaymentMethod);
  const [note, setNote] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [chequeBank, setChequeBank] = useState("");
  const [chequeStatus, setChequeStatus] = useState("pending");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Calculate payment info from sale
  const getBaseTotal = (s) =>
    Number(
      s?.discountedAmount != null
        ? s.discountedAmount
        : s?.totalAmount != null
        ? s.totalAmount
        : 0
    );

  const getPaid = (s) => Number(s?.amountPaid ?? 0);

  const getDue = (s) => Math.max(0, getBaseTotal(s) - getPaid(s));

  // Initialize form when sale changes
  useEffect(() => {
    if (sale && isOpen) {
      const due = getDue(sale);
      setAmount(due > 0 ? String(due) : "");
      // Set default payment method to first allowed method if current default is not allowed
      const initialMethod = allowedPaymentMethods.includes(defaultPaymentMethod)
        ? defaultPaymentMethod
        : allowedPaymentMethods[0] || "cash";
      setPaymentMethod(initialMethod);
      setNote("");
      setChequeNumber("");
      setChequeDate("");
      setChequeBank("");
      setChequeStatus("pending");
      setError("");
    }
  }, [sale, isOpen, defaultPaymentMethod, allowedPaymentMethods]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) {
      setError("Enter a valid amount greater than 0.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = {
        amount: amt,
        note: note || "",
        paymentMethod: paymentMethod,
      };

      // Add cheque fields if payment method is cheque
      if (paymentMethod === "cheque") {
        if (chequeNumber) payload.chequeNumber = chequeNumber;
        if (chequeDate) payload.chequeDate = chequeDate;
        if (chequeBank) payload.chequeBank = chequeBank;
        if (chequeStatus) payload.chequeStatus = chequeStatus;
      }

      const response = await api.patch(`/sales/${saleId}/payment`, payload);

      // Close modal
      onClose();

      // Call success callback with updated sale data
      if (onPaymentSuccess) {
        onPaymentSuccess(response.data?.sale || sale);
      }
    } catch (err) {
      console.error("Error recording payment:", err);
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to record payment."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const baseTotal = sale ? getBaseTotal(sale) : 0;
  const paid = sale ? getPaid(sale) : 0;
  const due = sale ? getDue(sale) : 0;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white shadow-2xl">
        <form onSubmit={handleSubmit}>
          <div className="border-b border-gray-200 px-5 py-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Record Payment
            </h3>
            <p className="text-sm text-gray-500">
              {sale?.saleId ? (
                <>
                  Sale <span className="font-medium">{sale.saleId}</span>
                  {customerName && (
                    <> • {customerName}</>
                  )}
                </>
              ) : (
                <>Sale ID: {saleId}</>
              )}
            </p>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
            {error && (
              <div className="rounded border border-red-200 bg-red-50 text-red-700 p-2">
                {error}
              </div>
            )}

            <div className="text-sm text-gray-600">
              <div>
                Base total: Rs. {baseTotal.toFixed(2)} | Paid: Rs. {paid.toFixed(2)}
              </div>
              <div>Due now: Rs. {due.toFixed(2)}</div>
            </div>

            <Field label="Amount" required>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="e.g. 2500"
                required
              />
            </Field>

            <Field label="Payment Method" required>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                required
              >
                {allowedPaymentMethods.includes("cash") && (
                  <option value="cash">Cash</option>
                )}
                {allowedPaymentMethods.includes("cheque") && (
                  <option value="cheque">Cheque</option>
                )}
              </select>
            </Field>

            {paymentMethod === "cheque" && (
              <>
                <Field label="Cheque Number">
                  <input
                    type="text"
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="e.g. CHQ123456"
                  />
                </Field>

                <Field label="Cheque Date">
                  <input
                    type="date"
                    value={chequeDate}
                    onChange={(e) => setChequeDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </Field>

                <Field label="Bank">
                  <input
                    type="text"
                    value={chequeBank}
                    onChange={(e) => setChequeBank(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="e.g. Bank of Ceylon"
                  />
                </Field>

                <Field label="Cheque Status">
                  <select
                    value={chequeStatus}
                    onChange={(e) => setChequeStatus(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    <option value="pending">Pending</option>
                    <option value="cleared">Cleared</option>
                    <option value="bounced">Bounced</option>
                  </select>
                </Field>
              </>
            )}

            <Field label="Note (optional)">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="cash / bank / reference"
              />
            </Field>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 bg-gray-50 px-5 py-4 rounded-b-xl flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Recording..." : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentModal;

