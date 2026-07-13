import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { ROUTER_BASENAME } from '../../config';
import PodcastNav from '../../components/PodcastNav';
import { useAuth } from '../../contexts/AuthContext';

interface BillingConfig {
  publishableKey: string | null;
  configured: boolean;
  defaultPrice: number;
  stripePriceConfigured?: boolean;
}

interface Subscription {
  monthly_payments?: boolean;
  active: boolean;
  status?: string;
  is_paying: boolean;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  amount?: number | null;
  currency?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Inner form rendered once a PaymentIntent client secret exists.
const CheckoutForm: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError('');

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}${ROUTER_BASENAME}/account/billing` },
      redirect: 'if_required'
    });

    if (confirmError) {
      setError(confirmError.message || 'Payment failed.');
      setSubmitting(false);
    } else {
      onDone();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && (
        <div className="pod-banner pod-banner-error" style={{ marginTop: '1rem' }}>
          {error}
        </div>
      )}
      <button type="submit" className="pod-btn" disabled={!stripe || submitting} style={{ marginTop: '1rem' }}>
        {submitting ? 'Processing…' : 'Confirm subscription'}
      </button>
    </form>
  );
};

const Billing: React.FC = () => {
  const { refreshUser } = useAuth();
  const [config, setConfig] = useState<BillingConfig | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const stripePromise = useMemo<Promise<Stripe | null> | null>(
    () => (config && config.publishableKey ? loadStripe(config.publishableKey) : null),
    [config]
  );

  const loadAll = useCallback(async () => {
    try {
      const cfg = await axios.get<BillingConfig>('/payments/config');
      setConfig(cfg.data);
      const sub = await axios.get<Subscription>('/payments/subscription');
      setSubscription(sub.data);
      await refreshUser();
    } catch (e) {
      setError('Could not load billing information.');
    } finally {
      setLoading(false);
    }
  }, [refreshUser]);

  // Webhooks can lag a moment after confirmPayment — poll profile briefly.
  const syncAccessAfterPayment = useCallback(async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const profile = await refreshUser();
      if (profile && (profile.is_paying === true || profile.is_paying === 1)) {
        return;
      }
      await sleep(800);
    }
    await refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const startSubscription = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await axios.post<{
        clientSecret: string | null;
        alreadyActive?: boolean;
        reused?: boolean;
        status?: string;
      }>('/payments/create-subscription');
      if (res.data.alreadyActive) {
        setMessage('You already have a subscription on this account.');
        await loadAll();
      } else if (res.data.clientSecret) {
        setClientSecret(res.data.clientSecret);
      } else {
        setError('Could not start payment. Please try again, or contact support if this continues.');
        await loadAll();
      }
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not start subscription.');
    } finally {
      setBusy(false);
    }
  };

  const openPortal = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await axios.post<{ url: string }>('/payments/create-portal-session');
      window.location.href = res.data.url;
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not open the billing portal.');
      setBusy(false);
    }
  };

  const cancelSubscription = async () => {
    if (!window.confirm('Cancel your subscription? You will lose access to episodes.')) return;
    setBusy(true);
    setError('');
    try {
      await axios.post('/payments/cancel');
      setMessage('Subscription cancelled.');
      await loadAll();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not cancel subscription.');
    } finally {
      setBusy(false);
    }
  };

  const handlePaymentDone = async () => {
    setClientSecret('');
    setMessage('Payment confirmed. Your subscription is now active.');
    await syncAccessAfterPayment();
    await loadAll();
  };

  return (
    <div className="podcast-page">
      <PodcastNav />
      <main className="podcast-main">
        <h2 className="podcast-section-title">Billing</h2>

        {error && <div className="pod-banner pod-banner-error">{error}</div>}
        {message && <div className="pod-banner pod-banner-success">{message}</div>}

        {loading ? (
          <div className="pod-empty">Loading…</div>
        ) : subscription && subscription.monthly_payments === false ? (
          <div className="pod-card">
            <h3 style={{ marginTop: 0 }}>Billing</h3>
            <p style={{ margin: 0 }}>
              Your account is managed by the administrator and is not billed monthly through Stripe.
              {subscription.is_paying
                ? ' Your access is currently active.'
                : ' Contact support if you need access restored.'}
            </p>
          </div>
        ) : !config?.configured ? (
          <div className="pod-card">
            <p style={{ margin: 0 }}>Billing is not configured yet. Please check back soon.</p>
          </div>
        ) : config.stripePriceConfigured === false ? (
          <div className="pod-card">
            <p style={{ margin: 0 }}>
              Billing is not ready: the official Stripe Price ID has not been set. An administrator
              must set <code>STRIPE_PRICE_ID</code> or platform <code>stripe_price_id</code>.
            </p>
          </div>
        ) : clientSecret && stripePromise ? (
          <div className="pod-card">
            <h3 style={{ marginTop: 0 }}>Enter payment details</h3>
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm onDone={handlePaymentDone} />
            </Elements>
          </div>
        ) : subscription && (subscription.active || subscription.is_paying) ? (
          <div className="pod-card">
            <h3 style={{ marginTop: 0 }}>Current Plan</h3>
            <p>
              Status: <strong>{subscription.status || (subscription.is_paying ? 'active' : 'inactive')}</strong>
            </p>
            {subscription.amount != null && (
              <p>
                Price: <strong>${subscription.amount.toFixed(2)}</strong> / month
              </p>
            )}
            {subscription.currentPeriodEnd && (
              <p>
                {subscription.cancelAtPeriodEnd ? 'Access ends' : 'Next billing date'}:{' '}
                <strong>{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</strong>
              </p>
            )}
            <div className="pod-inline-actions">
              <button type="button" className="pod-btn pod-btn-secondary" onClick={openPortal} disabled={busy}>
                Update payment method
              </button>
              <button type="button" className="pod-btn pod-btn-danger" onClick={cancelSubscription} disabled={busy}>
                Cancel subscription
              </button>
            </div>
          </div>
        ) : (
          <div className="pod-card">
            <h3 style={{ marginTop: 0 }}>Subscribe</h3>
            <p>
              Get full access to every episode for <strong>${config.defaultPrice.toFixed(2)}</strong> / month.
            </p>
            <button type="button" className="pod-btn" onClick={startSubscription} disabled={busy}>
              {busy ? 'Starting…' : 'Subscribe now'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Billing;
