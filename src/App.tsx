import React, { useState } from 'react';

const PRODUCTS = [
  {
    id: 1,
    name: "Ipakli kechki libos",
    price: 250000,
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=500",
    sizes: ["S", "M", "L"]
  },
  {
    id: 2,
    name: "Dantelli premium to'plam",
    price: 180000,
    image: "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=500",
    sizes: ["75B", "80B", "85C"]
  },
  {
    id: 3,
    name: "Kashshof pijama to'plami",
    price: 210000,
    image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500",
    sizes: ["M", "L", "XL"]
  }
];

export default function App() {
  const [cart, setCart] = useState([]);

  const addToCart = (product, size) => {
    setCart([...cart, { product, size }]);
    alert(`${product.name} (${size}) savatchaga qo'shildi!`);
  };

  const sendOrder = () => {
    if (cart.length === 0) return alert("Savatchangiz bo'sh!");
    
    let text = "🛍 Yangi buyurtma!\n\n";
    let total = 0;
    cart.forEach((item, index) => {
      text += `${index + 1}. ${item.product.name} (${item.size}) - ${item.product.price.toLocaleString()} so'm\n`;
      total += item.product.price;
    });
    text += `\n💰 Jami: ${total.toLocaleString()} so'm`;

    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.sendData(text);
      window.Telegram.WebApp.close();
    } else {
      alert("Buyurtma shakllandi:\n\n" + text);
    }
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '15px', backgroundColor: '#fff5f7', minHeight: '100vh' }}>
      <header style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h1 style={{ color: '#d63384', margin: '0' }}>Guli Lingerie</h1>
        <p style={{ color: '#666', fontSize: '14px', margin: '5px 0' }}>Ayollar uchun nafis va qulay kiyimlar</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
        {PRODUCTS.map((item) => (
          <div key={item.id} style={{ background: '#fff', borderRadius: '12px', padding: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <img src={item.image} alt={item.name} style={{ width: '100%', height: '220px', objectFit: 'cover', borderRadius: '8px' }} />
            <h3 style={{ fontSize: '16px', margin: '10px 0 5px' }}>{item.name}</h3>
            <p style={{ color: '#d63384', fontWeight: 'bold', margin: '0 0 10px' }}>{item.price.toLocaleString()} so'm</p>
            
            <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
              {item.sizes.map((size) => (
                <button
                  key={size}
                  onClick={() => addToCart(item, size)}
                  style={{
                    flex: 1,
                    padding: '6px',
                    border: '1px solid #d63384',
                    background: '#fff',
                    color: '#d63384',
                    borderRadius: '6px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  + {size}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {cart.length > 0 && (
        <div style={{ position: 'fixed', bottom: '15px', left: '15px', right: '15px' }}>
          <button
            onClick={sendOrder}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: '#d63384',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 'bold',
              fontSize: '16px',
              boxShadow: '0 4px 12px rgba(214, 51, 132, 0.4)'
            }}
          >
            🛒 Buyurtma berish ({cart.length})
          </button>
        </div>
      )}
    </div>
  );
}
