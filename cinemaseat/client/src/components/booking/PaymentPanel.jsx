import { useState } from 'react';
import { CreditCard, Smartphone, ShieldCheck } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

export default function PaymentPanel({ amount, onPay, loading }) {
  const [method, setMethod] = useState('bkash');

  return (
    <div className="bg-[#12121A] border border-[#2A2A40] rounded-2xl p-6 space-y-6">
      <div>
        <h3 className="font-['Syne'] font-bold text-lg text-[#F0F0FF]">Payment Method</h3>
        <p className="text-xs text-[#8888AA] mt-1">Select your preferred instant checkout provider</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { id: 'bkash', name: 'bKash', icon: Smartphone },
          { id: 'nagad', name: 'Nagad', icon: Smartphone },
          { id: 'card', name: 'Card', icon: CreditCard },
        ].map((item) => {
          const Icon = item.icon;
          const isSelected = method === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setMethod(item.id)}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-xs font-semibold transition-all ${
                isSelected
                  ? 'bg-[#F5A623]/10 border-[#F5A623] text-[#F5A623]'
                  : 'bg-[#1C1C2E] border-[#2A2A40] text-[#8888AA] hover:border-[#555570]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.name}</span>
            </button>
          );
        })}
      </div>

      <div className="pt-4 border-t border-[#2A2A40] flex items-center justify-between">
        <div>
          <span className="text-xs text-[#8888AA]">Total Payable</span>
          <div className="text-xl font-bold font-mono text-[#F5A623]">
            {formatCurrency(amount)}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onPay(method)}
          disabled={loading}
          className="px-6 py-3 rounded-xl bg-[#F5A623] text-[#0A0A0F] font-semibold text-sm hover:bg-[#C47D10] disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-[#F5A623]/20"
        >
          <ShieldCheck className="w-4 h-4" />
          {loading ? 'Initiating Gateway...' : 'Pay Now'}
        </button>
      </div>
    </div>
  );
}
