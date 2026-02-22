import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description={siteConfig.tagline}>
      <header className={styles.hero}>
        <div className="container">
          <span className={styles.badge}>Open Source</span>
          <Heading as="h1" className={styles.heroTitle}>
            Debug NgRx<br />
            <span className={styles.heroAccent}>visually.</span>
          </Heading>
          <p className={styles.heroSubtitle}>
            Track actions, effects, and state in real-time.
          </p>
          <div className={styles.ctaGroup}>
            <Link className="button button--primary button--lg" to="/docs/getting-started/quick-start">
              Get Started
            </Link>
            <Link className="button button--secondary button--lg" to="/docs/features/action-monitoring">
              View Features
            </Link>
          </div>
        </div>
      </header>
      <main>
        <section className={styles.demo}>
          <div className="container">
            <Heading as="h2">See it in action</Heading>
            <div className={styles.demoContainer}>
              <img src="img/devtool-on-pct.gif" alt="NgRx DevTool Demo" />
            </div>
          </div>
        </section>
        <section className={styles.features}>
          <div className="container">
            <div className={styles.featuresGrid}>
              <div className={styles.featureCard}>
                <Heading as="h3">Real-time Monitoring</Heading>
                <p>Track all dispatched actions as they happen with live updates.</p>
              </div>
              <div className={styles.featureCard}>
                <Heading as="h3">Effect Lifecycle</Heading>
                <p>Monitor effect execution with start, emit, complete, and error tracking.</p>
              </div>
              <div className={styles.featureCard}>
                <Heading as="h3">State Visualization</Heading>
                <p>Explore your application state with an interactive tree view.</p>
              </div>
              <div className={styles.featureCard}>
                <Heading as="h3">Performance Metrics</Heading>
                <p>Monitor reducer execution time and render timing per action.</p>
              </div>
              <div className={styles.featureCard}>
                <Heading as="h3">Diff Viewer</Heading>
                <p>Compare state changes between actions with highlighted differences.</p>
              </div>
              <div className={styles.featureCard}>
                <Heading as="h3">Action Correlation</Heading>
                <p>See which effect emitted each action with color-coded indicators.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}

