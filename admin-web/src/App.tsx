import type { Session, User } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';

import {
  approveBrandIngestion,
  createAdminBrandImport,
  fetchAdminBrandReviewDetail,
  fetchAdminBrandReviewItems,
  ingestBrandProducts,
  markBrandLive,
  publishAllBrandProducts,
  publishProduct,
  rejectBrandIngestion,
  rejectProduct,
  updateAdminBrand,
  updateAdminProduct,
  type AdminBrandReviewDetail,
  type AdminBrandReviewItem,
} from './lib/brandIngestion';
import { sourceTypeLabel } from './lib/brandRequestUtils';
import { isAdminUser } from './lib/adminAccess';
import { supabase } from './lib/supabase';

function ingestionStatusLabel(status: string): string {
  if (status === 'in_progress') {
    return 'In Progress';
  }

  if (status === 'needs_review') {
    return 'Needs Review';
  }

  if (status === 'live') {
    return 'Live';
  }

  if (status === 'failed') {
    return 'Failed';
  }

  return 'Pending';
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const [items, setItems] = useState<AdminBrandReviewItem[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminBrandReviewDetail | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const [brandName, setBrandName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setUser(data.session?.user ?? null);
      })
      .finally(() => {
        setAuthLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const adminEnabled = isAdminUser(user?.email);

  async function loadQueue(selectBrandId?: string | null): Promise<void> {
    if (!adminEnabled) {
      return;
    }

    setLoadingQueue(true);
    setError(null);
    try {
      const nextItems = await fetchAdminBrandReviewItems();
      setItems(nextItems);

      const preferredId = selectBrandId ?? selectedBrandId ?? nextItems[0]?.brand.id ?? null;
      setSelectedBrandId(preferredId);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load review queue.');
    } finally {
      setLoadingQueue(false);
    }
  }

  async function loadDetail(brandId: string): Promise<void> {
    setLoadingDetail(true);
    setError(null);
    try {
      const nextDetail = await fetchAdminBrandReviewDetail(brandId);
      setDetail(nextDetail);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load brand detail.');
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => {
    if (!adminEnabled) {
      return;
    }

    void loadQueue();
  }, [adminEnabled]);

  useEffect(() => {
    if (!adminEnabled || !selectedBrandId) {
      setDetail(null);
      return;
    }

    void loadDetail(selectedBrandId);
  }, [adminEnabled, selectedBrandId]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return items;
    }

    return items.filter((item) => {
      const name = item.brand.name.toLowerCase();
      const domain = item.brand.domain.toLowerCase();
      return name.includes(normalized) || domain.includes(normalized);
    });
  }, [items, query]);

  async function withAction(key: string, fn: () => Promise<void>, successMessage: string, brandId?: string): Promise<void> {
    setBusyKey(key);
    setError(null);
    setMessage(null);

    try {
      await fn();
      setMessage(successMessage);
      await loadQueue(brandId ?? selectedBrandId);
      if (brandId ?? selectedBrandId) {
        await loadDetail((brandId ?? selectedBrandId)!);
      }
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to complete that action.');
    } finally {
      setBusyKey(null);
    }
  }

  async function signInWithPassword(): Promise<void> {
    setAuthError(null);
    setAuthMessage(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setAuthError(signInError.message);
    }
  }

  async function sendMagicLink(): Promise<void> {
    setAuthError(null);
    setAuthMessage(null);
    const { error: magicLinkError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });

    if (magicLinkError) {
      setAuthError(magicLinkError.message);
      return;
    }

    setAuthMessage('Magic link sent. Open it in this browser to continue.');
  }

  async function signOut(): Promise<void> {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setAuthError(signOutError.message);
    }
  }

  async function onImportBrand(): Promise<void> {
    if (!brandName.trim()) {
      setError('Brand name is required.');
      return;
    }

    await withAction(
      'import',
      async () => {
        const result = await createAdminBrandImport({
          name: brandName,
          websiteUrl,
          instagramUrl,
          category,
          initiatedByUserId: user?.id ?? null,
        });

        setBrandName('');
        setWebsiteUrl('');
        setInstagramUrl('');
        setCategory('');
        setSelectedBrandId(result.brand.id);
      },
      `${brandName.trim()} imported into the review queue.`
    );
  }

  if (authLoading) {
    return <div className="shell center-panel">Checking session...</div>;
  }

  if (!session || !user) {
    return (
      <div className="shell auth-shell">
        <div className="auth-card">
          <p className="eyebrow">Fashaun Admin</p>
          <h1>Brand ingestion and review</h1>
          <p className="muted">
            This web app uses the same Supabase project as the customer mobile app. Sign in with your admin account.
          </p>

          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
          </label>

          <label>
            Password
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
          </label>

          <div className="row">
            <button onClick={() => void signInWithPassword()}>Sign In</button>
            <button className="secondary" onClick={() => void sendMagicLink()}>
              Send Magic Link
            </button>
          </div>

          {authError ? <p className="error">{authError}</p> : null}
          {authMessage ? <p className="success">{authMessage}</p> : null}
        </div>
      </div>
    );
  }

  if (!adminEnabled) {
    return (
      <div className="shell center-panel">
        <div className="panel">
          <p className="eyebrow">Access restricted</p>
          <h1>Admin access required</h1>
          <p className="muted">
            Add this account to <code>VITE_ADMIN_EMAILS</code> to use the internal ingestion tool.
          </p>
          <button className="secondary" onClick={() => void signOut()}>
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Internal tool</p>
          <h1>Fashaun Admin</h1>
          <p className="muted">Validate brands, ingest products, review drafts, and publish only what should go live.</p>
        </div>
        <div className="topbar-actions">
          <span className="user-chip">{user.email}</span>
          <button className="secondary" onClick={() => void loadQueue()}>
            Refresh
          </button>
          <button className="secondary" onClick={() => void signOut()}>
            Sign Out
          </button>
        </div>
      </header>

      {error ? <div className="banner error">{error}</div> : null}
      {message ? <div className="banner success">{message}</div> : null}

      <section className="import-card">
        <div>
          <p className="eyebrow">New import</p>
          <h2>Import a brand into review</h2>
        </div>
        <div className="form-grid">
          <label>
            Brand name
            <input value={brandName} onChange={(event) => setBrandName(event.target.value)} />
          </label>
          <label>
            Website or domain
            <input value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} />
          </label>
          <label>
            Instagram
            <input value={instagramUrl} onChange={(event) => setInstagramUrl(event.target.value)} />
          </label>
          <label>
            Category
            <input value={category} onChange={(event) => setCategory(event.target.value)} />
          </label>
        </div>
        <div className="row">
          <button onClick={() => void onImportBrand()} disabled={busyKey === 'import'}>
            {busyKey === 'import' ? 'Importing...' : 'Import Brand'}
          </button>
        </div>
      </section>

      <main className="workspace">
        <section className="queue-panel panel">
          <div className="queue-header">
            <div>
              <p className="eyebrow">Review queue</p>
              <h2>Brands awaiting validation</h2>
            </div>
            <input
              className="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search brands"
            />
          </div>

          {loadingQueue ? <p className="muted">Loading queue...</p> : null}

          <div className="queue-list">
            {filteredItems.map((item) => (
              <button
                key={item.brand.id}
                className={`queue-card${selectedBrandId === item.brand.id ? ' selected' : ''}`}
                onClick={() => setSelectedBrandId(item.brand.id)}
              >
                <div className="row spread">
                  <div>
                    <h3>{item.brand.name}</h3>
                    <p className="muted">{item.brand.domain}</p>
                  </div>
                  <span className="pill">{ingestionStatusLabel(item.brand.ingestion_status)}</span>
                </div>
                <p className="meta-line">
                  {sourceTypeLabel(item.brand.source_type)} • {item.productCount} total • {item.liveProductCount} live •{' '}
                  {item.draftProductCount} draft
                </p>
              </button>
            ))}
            {!loadingQueue && filteredItems.length === 0 ? <p className="muted">No brands matched your search.</p> : null}
          </div>
        </section>

        <section className="detail-panel panel">
          {!selectedBrandId ? <p className="muted">Select a brand from the queue to review its draft products.</p> : null}
          {selectedBrandId && loadingDetail ? <p className="muted">Loading brand details...</p> : null}
          {detail ? (
            <BrandDetail
              detail={detail}
              busyKey={busyKey}
              onApprove={() =>
                withAction('approve-brand', () => approveBrandIngestion(detail.brand.id), `${detail.brand.name} approved.`, detail.brand.id)
              }
              onReject={() =>
                withAction(
                  'reject-brand',
                  () => rejectBrandIngestion(detail.brand.id),
                  `${detail.brand.name} rejected with its products.`,
                  detail.brand.id
                )
              }
              onRetry={() =>
                withAction(
                  'retry-brand',
                  () => ingestBrandProducts({ brandId: detail.brand.id, initiatedByUserId: user.id }).then(() => undefined),
                  `${detail.brand.name} ingestion retried.`,
                  detail.brand.id
                )
              }
              onPublishProducts={() =>
                withAction(
                  'publish-brand-products',
                  () => publishAllBrandProducts(detail.brand.id),
                  `${detail.brand.name} products are now live.`,
                  detail.brand.id
                )
              }
              onMarkLive={() =>
                withAction('mark-brand-live', () => markBrandLive(detail.brand.id), `${detail.brand.name} is now live.`, detail.brand.id)
              }
              onSaveBrand={(input) =>
                withAction(
                  'save-brand',
                  () => updateAdminBrand(detail.brand.id, input).then(() => undefined),
                  `${input.name} updated.`,
                  detail.brand.id
                )
              }
              onSaveProduct={(productId, input) =>
                withAction(
                  `save-product-${productId}`,
                  () => updateAdminProduct(productId, input),
                  `${input.name} updated.`,
                  detail.brand.id
                )
              }
              onPublishProduct={(productId, name) =>
                withAction(`publish-product-${productId}`, () => publishProduct(productId), `${name} published.`, detail.brand.id)
              }
              onRejectProduct={(productId, name) =>
                withAction(`reject-product-${productId}`, () => rejectProduct(productId), `${name} rejected.`, detail.brand.id)
              }
            />
          ) : null}
        </section>
      </main>
    </div>
  );
}

function BrandDetail(props: {
  detail: AdminBrandReviewDetail;
  busyKey: string | null;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
  onRetry: () => Promise<void>;
  onPublishProducts: () => Promise<void>;
  onMarkLive: () => Promise<void>;
  onSaveBrand: (input: {
    name: string;
    domain: string;
    instagramHandle?: string | null;
    category?: string | null;
    sourceUrl?: string | null;
  }) => Promise<void>;
  onSaveProduct: (
    productId: string,
    input: { name: string; priceAmount: number | null; productUrl?: string | null; category?: string | null }
  ) => Promise<void>;
  onPublishProduct: (productId: string, name: string) => Promise<void>;
  onRejectProduct: (productId: string, name: string) => Promise<void>;
}) {
  const { detail, busyKey } = props;
  const [brandName, setBrandName] = useState(detail.brand.name);
  const [domain, setDomain] = useState(detail.brand.domain);
  const [instagramHandle, setInstagramHandle] = useState(detail.brand.instagram_handle ?? '');
  const [category, setCategory] = useState(detail.brand.category ?? '');
  const [sourceUrl, setSourceUrl] = useState(detail.brand.source_url ?? '');

  useEffect(() => {
    setBrandName(detail.brand.name);
    setDomain(detail.brand.domain);
    setInstagramHandle(detail.brand.instagram_handle ?? '');
    setCategory(detail.brand.category ?? '');
    setSourceUrl(detail.brand.source_url ?? '');
  }, [detail]);

  const liveCount = detail.products.filter((product) => product.status === 'live').length;

  return (
    <div className="detail-body">
      <div className="row spread detail-header">
        <div>
          <p className="eyebrow">Review detail</p>
          <h2>{detail.brand.name}</h2>
          <p className="meta-line">
            {sourceTypeLabel(detail.brand.source_type)} • Brand status: {detail.brand.status} • Products live: {liveCount}
          </p>
        </div>
        <span className="pill">{ingestionStatusLabel(detail.brand.ingestion_status)}</span>
      </div>

      <section className="panel subtle">
        <h3>Brand details</h3>
        <div className="form-grid">
          <label>
            Brand name
            <input value={brandName} onChange={(event) => setBrandName(event.target.value)} />
          </label>
          <label>
            Domain
            <input value={domain} onChange={(event) => setDomain(event.target.value)} />
          </label>
          <label>
            Instagram handle
            <input value={instagramHandle} onChange={(event) => setInstagramHandle(event.target.value)} />
          </label>
          <label>
            Category
            <input value={category} onChange={(event) => setCategory(event.target.value)} />
          </label>
          <label className="full-width">
            Source URL
            <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} />
          </label>
        </div>
        <div className="row wrap">
          <button
            className="secondary"
            onClick={() =>
              void props.onSaveBrand({
                name: brandName,
                domain,
                instagramHandle,
                category,
                sourceUrl,
              })
            }
            disabled={busyKey === 'save-brand'}
          >
            Save Brand
          </button>
          <button className="secondary" onClick={() => void props.onRetry()} disabled={busyKey === 'retry-brand'}>
            Retry Ingestion
          </button>
          <button className="secondary" onClick={() => void props.onApprove()} disabled={busyKey === 'approve-brand'}>
            Approve Brand
          </button>
          <button
            className="secondary"
            onClick={() => void props.onPublishProducts()}
            disabled={busyKey === 'publish-brand-products'}
          >
            Publish All Products
          </button>
          <button className="secondary" onClick={() => void props.onMarkLive()} disabled={busyKey === 'mark-brand-live'}>
            Mark Brand Live
          </button>
          <button
            className="danger"
            onClick={() => {
              if (window.confirm(`Reject ${detail.brand.name} and its products?`)) {
                void props.onReject();
              }
            }}
            disabled={busyKey === 'reject-brand'}
          >
            Reject Brand
          </button>
        </div>
      </section>

      <section className="products-section">
        <div className="row spread">
          <h3>Imported products</h3>
          <span className="muted">{detail.products.length} products</span>
        </div>
        {detail.products.length === 0 ? <p className="muted">No imported products yet. Retry ingestion to fetch products.</p> : null}
        <div className="products-grid">
          {detail.products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              busy={busyKey?.includes(product.id) ?? false}
              onSave={(input) => props.onSaveProduct(product.id, input)}
              onPublish={() => props.onPublishProduct(product.id, product.name)}
              onReject={() => props.onRejectProduct(product.id, product.name)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function ProductCard(props: {
  product: AdminBrandReviewDetail['products'][number];
  busy: boolean;
  onSave: (input: { name: string; priceAmount: number | null; productUrl?: string | null; category?: string | null }) => Promise<void>;
  onPublish: () => Promise<void>;
  onReject: () => Promise<void>;
}) {
  const { product, busy } = props;
  const [name, setName] = useState(product.name);
  const [priceAmount, setPriceAmount] = useState(product.price_amount !== null ? String(product.price_amount) : '');
  const [productUrl, setProductUrl] = useState(product.product_url ?? '');
  const [category, setCategory] = useState(product.category ?? '');

  useEffect(() => {
    setName(product.name);
    setPriceAmount(product.price_amount !== null ? String(product.price_amount) : '');
    setProductUrl(product.product_url ?? '');
    setCategory(product.category ?? '');
  }, [product]);

  return (
    <article className="product-card">
      <div className="row spread">
        <div>
          <h4>{product.name}</h4>
          <p className="meta-line">
            Status: {product.status} • Confidence:{' '}
            {product.confidence_score !== null ? `${Math.round(product.confidence_score * 100)}%` : 'N/A'}
          </p>
        </div>
        <span className="pill">{product.status}</span>
      </div>

      <label>
        Product name
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label>
        Price
        <input value={priceAmount} onChange={(event) => setPriceAmount(event.target.value)} />
      </label>
      <label>
        Product URL
        <input value={productUrl} onChange={(event) => setProductUrl(event.target.value)} />
      </label>
      <label>
        Category
        <input value={category} onChange={(event) => setCategory(event.target.value)} />
      </label>

      <div className="row wrap">
        <button
          className="secondary"
          onClick={() =>
            void props.onSave({
              name,
              priceAmount: priceAmount.trim() ? Number(priceAmount) : null,
              productUrl,
              category,
            })
          }
          disabled={busy}
        >
          Save Product
        </button>
        <button className="secondary" onClick={() => void props.onPublish()} disabled={busy}>
          Publish Product
        </button>
        <button
          className="danger"
          onClick={() => {
            if (window.confirm(`Reject ${product.name}?`)) {
              void props.onReject();
            }
          }}
          disabled={busy}
        >
          Reject Product
        </button>
      </div>
    </article>
  );
}
