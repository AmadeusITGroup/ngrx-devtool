import type {ReactNode} from 'react';
import {useState} from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function CopyButton({text}: {text: string}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      className={styles.copyButton}
      onClick={handleCopy}
      aria-label="Copy to clipboard"
      title="Copy to clipboard"
    >
      {copied ? '✓' : '⧉'}
    </button>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  const installCmd = 'npm install ngrx-devtool';

  return (
    <Layout
      title={siteConfig.title}
      description={siteConfig.tagline}>
      <main className={styles.heroFullPage}>
        <div className={styles.heroContent}>
          <Heading as="h1" className={styles.heroTitle}>
            NgRx DevTool
          </Heading>
          <p className={styles.heroSubtitle}>
            A real-time visual debugger for NgRx applications
          </p>

          <div className={styles.installBox}>
            <code className={styles.installCode}>{installCmd}</code>
            <CopyButton text={installCmd} />
          </div>

          <div className={styles.ctaGroup}>
            <Link className={styles.ctaPrimary} to="/docs/getting-started/quick-start">
              Get Started
            </Link>
            <Link
              className={styles.ctaSecondary}
              href="https://github.com/amadeusitgroup/ngrx-devtool"
            >
              GitHub ↗
            </Link>
          </div>

          <div className={styles.badges}>
            <img
              src="https://img.shields.io/badge/angular-17+-dd0031?style=flat-square&logo=angular&logoColor=white"
              alt="Angular 17+"
            />
            <img
              src="https://img.shields.io/badge/license-MIT-22c55e?style=flat-square"
              alt="MIT License"
            />
            <img
              src="https://img.shields.io/badge/platform-Web-0ea5e9?style=flat-square"
              alt="Platform: Web"
            />
          </div>
        </div>

        <section className={styles.demo}>
          <div className="container">
            <Heading as="h2">See it in action</Heading>
            <div className={styles.demoContainer}>
              <img src="img/devtool-on-pct.gif" alt="NgRx DevTool Demo" />
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}

