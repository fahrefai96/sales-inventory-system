import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaBoxes, FaWarehouse, FaStar, FaExclamationTriangle, FaArrowDown } from "react-icons/fa";

const DashboardPanel = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("pos-token");

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await axios.get("http://localhost:3000/api/dashboard", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setData(res.data);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [token]);

  if (loading) return <p className="p-6">Loading dashboard...</p>;
  if (!data) return <p className="p-6 text-red-500">Failed to load dashboard data.</p>;

  const cardStyle = "p-4 rounded shadow flex items-center gap-4 text-white";
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard Summary</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`${cardStyle} bg-blue-500`}>
          <FaBoxes size={36} />
          <div>
            <h2 className="text-lg font-semibold">Total Products</h2>
            <p className="text-2xl">{data.totalProducts}</p>
          </div>
        </div>

        <div className={`${cardStyle} bg-green-500`}>
          <FaWarehouse size={36} />
          <div>
            <h2 className="text-lg font-semibold">Total Stock</h2>
            <p className="text-2xl">{data.totalStock}</p>
          </div>
        </div>

        <div className={`${cardStyle} bg-yellow-500`}>
          <FaStar size={36} />
          <div>
            <h2 className="text-lg font-semibold">Highest Sale Product</h2>
            <p>{data.highestSaleProduct?.name || data.highestSaleProduct?.message}</p>
            {data.highestSaleProduct?.sold && <p>Sold: {data.highestSaleProduct.sold}</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`${cardStyle} bg-red-500`}>
          <FaExclamationTriangle size={36} />
          <div>
            <h2 className="text-lg font-semibold">Out of Stock Products</h2>
            {data.outOfStock.length === 0 ? (
              <p>None</p>
            ) : (
              data.outOfStock.map((p) => (
                <p key={p._id}>
                  {p.name} ({p.stock})
                </p>
              ))
            )}
          </div>
        </div>

        <div className={`${cardStyle} bg-orange-500`}>
          <FaArrowDown size={36} />
          <div>
            <h2 className="text-lg font-semibold">Low Stock Products (&lt;5)</h2>
            {data.lowStock.length === 0 ? (
              <p>None</p>
            ) : (
              data.lowStock.map((p) => (
                <p key={p._id}>
                  {p.name} ({p.stock})
                </p>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPanel;