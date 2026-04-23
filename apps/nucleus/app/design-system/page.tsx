'use client'

import { useState } from 'react'
import { Breadcrumb, Button, Checkbox, ChevronButton, FormField, Icon, NavBar, Notification, Radio, Stepper, Tabs } from '@plato/ui/components/rmg'
import type { IconName } from '@plato/ui/components/rmg'

function TabsDesktopDemo() {
  const [active, setActive] = useState('tracked')
  return (
    <Tabs
      size="desktop"
      activeId={active}
      onChange={setActive}
      items={[
        { id: 'tracked',    label: 'Tracked' },
        { id: 'returns',    label: 'Returns' },
        { id: 'intl',       label: 'International' },
        { id: 'guaranteed', label: 'Guaranteed' },
        { id: 'marketing',  label: 'Marketing mail' },
      ]}
    />
  )
}

function TabsMobileDemo() {
  const [active, setActive] = useState('tracked')
  return (
    <Tabs
      size="mobile"
      activeId={active}
      onChange={setActive}
      items={[
        { id: 'tracked',    label: 'Tracked' },
        { id: 'returns',    label: 'Returns' },
        { id: 'intl',       label: 'International' },
        { id: 'guaranteed', label: 'Guaranteed' },
      ]}
    />
  )
}

const DEMO_STEPS = [
  { label: 'Select options' },
  { label: 'Provide details' },
  { label: 'Send item' },
  { label: 'Payment' },
  { label: 'Confirmation' },
]

function StepperDemo() {
  const [current, setCurrent] = useState(3)
  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-3 items-center">
        <span className="font-body text-b3 text-[var(--rmg-color-text-light)]">
          Current step:
        </span>
        {DEMO_STEPS.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i + 1)}
            className={`w-8 h-8 rounded-full text-sm font-bold border ${
              current === i + 1
                ? 'bg-[var(--rmg-color-red)] text-white border-transparent'
                : 'bg-white text-[var(--rmg-color-text-heading)] border-[var(--rmg-color-grey-2)]'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <div style={{ margin: '0 calc(-1 * var(--rmg-spacing-07))' }}>
        <Stepper
          steps={DEMO_STEPS}
          currentStep={current}
          processTitle="Send your item"
          paddingX={32}
        />
      </div>
    </div>
  )
}

const NAV_DEMO_ITEMS = [
  { label: 'Personal', href: '#' },
  { label: 'Business', active: true },
  { label: 'Stamps & supplies', hasDropdown: true },
  { label: 'Help & support' },
]

function NavBarLogoPlaceholder() {
  return (
    <svg width="108" height="36" viewBox="0 0 108 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Logo placeholder">
      <rect width="108" height="36" rx="4" fill="#DA202A" />
      <rect x="8" y="7" width="28" height="22" rx="2" fill="#FFFFFF" />
      <rect x="8" y="16" width="92" height="4" fill="#DA202A" />
      <rect x="44" y="10" width="56" height="5" rx="2" fill="#FFFFFF" opacity="0.9" />
      <rect x="44" y="21" width="38" height="3" rx="1.5" fill="#FFFFFF" opacity="0.55" />
    </svg>
  )
}

function RadioGroupDemo() {
  const [selected, setSelected] = useState('tracked')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rmg-spacing-01)' }}>
      <Radio label="Tracked" size="large" name="demo-group" value="tracked" checked={selected === 'tracked'} onChange={setSelected} />
      <Radio label="Express" size="large" name="demo-group" value="express" checked={selected === 'express'} onChange={setSelected} />
      <Radio label="Standard" size="large" name="demo-group" value="standard" checked={selected === 'standard'} onChange={setSelected} />
    </div>
  )
}

export default function DesignSystemPage() {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--rmg-spacing-09) var(--rmg-spacing-07)' }}>

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 'var(--rmg-spacing-11)' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--rmg-spacing-04)',
            backgroundColor: 'var(--rmg-color-red)',
            padding: 'var(--rmg-spacing-03) var(--rmg-spacing-06)',
            borderRadius: 'var(--rmg-radius-s)',
            marginBottom: 'var(--rmg-spacing-06)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--rmg-font-display)',
              fontSize: 'var(--rmg-text-h4)',
              lineHeight: 'var(--rmg-leading-h4)',
              color: 'var(--rmg-color-white)',
              fontWeight: 700,
            }}
          >
            Royal Mail
          </span>
        </div>
        <h1
          style={{
            fontFamily: 'var(--rmg-font-display)',
            fontSize: 'var(--rmg-text-d2)',
            lineHeight: 'var(--rmg-leading-d2)',
            color: 'var(--rmg-color-text-heading)',
            marginBottom: 'var(--rmg-spacing-03)',
          }}
        >
          Design System
        </h1>
        <p
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-b2)',
            lineHeight: 'var(--rmg-leading-b2)',
            color: 'var(--rmg-color-text-light)',
          }}
        >
          v1 · Token reference extracted from Figma RM-Design-System
        </p>
      </div>

      {/* ── COLOURS ────────────────────────────────────────────────── */}
      <Section title="Colours">

        <ColourGroup label="Core Brand">
          <Swatch name="red"          token="--rmg-color-red"          hex="#DA202A" />
          <Swatch name="yellow"       token="--rmg-color-yellow"        hex="#FDDA24" dark />
          <Swatch name="white"        token="--rmg-color-white"         hex="#FFFFFF" dark border />
        </ColourGroup>

        <ColourGroup label="Primary Accents">
          <Swatch name="warm-red"     token="--rmg-color-warm-red"      hex="#B70D12" />
          <Swatch name="bright-red"   token="--rmg-color-bright-red"    hex="#E63338" />
          <Swatch name="pink"         token="--rmg-color-pink"          hex="#F4AEBA" dark />
          <Swatch name="orange"       token="--rmg-color-orange"        hex="#F3920D" dark />
        </ColourGroup>

        <ColourGroup label="Greys">
          <Swatch name="black"        token="--rmg-color-black"         hex="#2A2A2D" />
          <Swatch name="dark-grey"    token="--rmg-color-dark-grey"     hex="#404044" />
          <Swatch name="grey-1"       token="--rmg-color-grey-1"        hex="#8F9495" />
          <Swatch name="grey-2"       token="--rmg-color-grey-2"        hex="#D5D5D5" dark />
          <Swatch name="grey-3"       token="--rmg-color-grey-3"        hex="#EEEEEE" dark />
          <Swatch name="grey-4"       token="--rmg-color-grey-4"        hex="#F5F5F5" dark border />
          <Swatch name="grey-300"     token="--rmg-color-grey-300"      hex="#D9D9D9" dark />
          <Swatch name="brand-black"  token="--rmg-color-brand-black"   hex="#2A2A2A" />
        </ColourGroup>

        <ColourGroup label="Functional">
          <Swatch name="blue"           token="--rmg-color-blue"           hex="#0892CB" />
          <Swatch name="green"          token="--rmg-color-green"          hex="#62A531" />
          <Swatch name="green-contrast" token="--rmg-color-green-contrast" hex="#008A00" />
        </ColourGroup>

        <ColourGroup label="Tints">
          <Swatch name="tint-yellow" token="--rmg-color-tint-yellow" hex="#FEEB87" dark />
          <Swatch name="tint-orange" token="--rmg-color-tint-orange" hex="#FFBD80" dark />
          <Swatch name="tint-pink"   token="--rmg-color-tint-pink"   hex="#F9CFD6" dark />
          <Swatch name="tint-green"  token="--rmg-color-tint-green"  hex="#C1E3C1" dark />
          <Swatch name="tint-red"    token="--rmg-color-tint-red"    hex="#F8E7E7" dark />
        </ColourGroup>

        <ColourGroup label="Surfaces">
          <Swatch name="surface-white" token="--rmg-color-surface-white" hex="#FFFFFF" dark border />
          <Swatch name="surface-light" token="--rmg-color-surface-light" hex="#F1F2F5" dark border />
        </ColourGroup>

        <ColourGroup label="Semantic Text — Light Mode">
          <Swatch name="text-heading" token="--rmg-color-text-heading" hex="#2A2A2D" />
          <Swatch name="text-body"    token="--rmg-color-text-body"    hex="#333333" />
          <Swatch name="text-light"   token="--rmg-color-text-light"   hex="#666666" />
          <Swatch name="text-accent"  token="--rmg-color-text-accent"  hex="#DA202A" />
        </ColourGroup>

        <ColourGroup label="Semantic Text — Dark Mode">
          <Swatch name="text-dark-heading" token="--rmg-color-text-dark-heading" hex="#FFFFFF" dark border />
          <Swatch name="text-dark-accent"  token="--rmg-color-text-dark-accent"  hex="#FDDA24" dark />
        </ColourGroup>

      </Section>

      {/* ── TYPOGRAPHY ─────────────────────────────────────────────── */}
      <Section title="Typography">

        <div style={{ marginBottom: 'var(--rmg-spacing-06)' }}>
          <TypeLabel>Display — RM First Class (responsive)</TypeLabel>
        </div>

        <TypeSample
          label="D1"
          sizeToken="--rmg-text-d1"
          leadToken="--rmg-leading-d1"
          family="var(--rmg-font-display)"
          sample="Royal Mail delivers"
        />
        <TypeSample
          label="D2"
          sizeToken="--rmg-text-d2"
          leadToken="--rmg-leading-d2"
          family="var(--rmg-font-display)"
          sample="Royal Mail delivers"
        />

        <div style={{ marginTop: 'var(--rmg-spacing-07)', marginBottom: 'var(--rmg-spacing-06)' }}>
          <TypeLabel>Headings — RM First Class (responsive)</TypeLabel>
        </div>

        {(['h1','h2','h3','h4','h5','h6','h7'] as const).map((level) => (
          <TypeSample
            key={level}
            label={level.toUpperCase()}
            sizeToken={`--rmg-text-${level}`}
            leadToken={`--rmg-leading-${level}`}
            family="var(--rmg-font-display)"
            sample="The quick brown fox"
          />
        ))}

        <div style={{ marginTop: 'var(--rmg-spacing-07)', marginBottom: 'var(--rmg-spacing-06)' }}>
          <TypeLabel>Body — PF DinText Std (fixed)</TypeLabel>
        </div>

        {(['b1','b2','b3'] as const).map((level) => (
          <TypeSample
            key={level}
            label={level.toUpperCase()}
            sizeToken={`--rmg-text-${level}`}
            leadToken={`--rmg-leading-${level}`}
            family="var(--rmg-font-body)"
            sample="The quick brown fox jumps over the lazy dog"
          />
        ))}

        <div style={{ marginTop: 'var(--rmg-spacing-07)', marginBottom: 'var(--rmg-spacing-06)' }}>
          <TypeLabel>Caption — PF DinText Std (fixed)</TypeLabel>
        </div>

        {(['c1','c2'] as const).map((level) => (
          <TypeSample
            key={level}
            label={level.toUpperCase()}
            sizeToken={`--rmg-text-${level}`}
            leadToken={`--rmg-leading-${level}`}
            family="var(--rmg-font-body)"
            sample="The quick brown fox jumps over the lazy dog"
          />
        ))}

      </Section>

      {/* ── SPACING ────────────────────────────────────────────────── */}
      <Section title="Spacing">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rmg-spacing-03)' }}>
          {[
            { num: '01', px: '4px' },
            { num: '02', px: '8px' },
            { num: '03', px: '12px' },
            { num: '04', px: '16px' },
            { num: '05', px: '20px' },
            { num: '06', px: '24px' },
            { num: '07', px: '32px' },
            { num: '08', px: '40px' },
            { num: '09', px: '48px' },
            { num: '10', px: '64px' },
            { num: '11', px: '80px' },
            { num: '12', px: '96px' },
            { num: '13', px: '128px' },
          ].map(({ num, px }) => (
            <div key={num} style={{ display: 'flex', alignItems: 'center', gap: 'var(--rmg-spacing-05)' }}>
              <span
                style={{
                  width: '80px',
                  fontSize: 'var(--rmg-text-c1)',
                  lineHeight: 'var(--rmg-leading-c1)',
                  color: 'var(--rmg-color-text-light)',
                  fontFamily: 'var(--rmg-font-body)',
                  flexShrink: 0,
                }}
              >
                spacing-{num}
              </span>
              <div
                style={{
                  height: '20px',
                  width: `var(--rmg-spacing-${num})`,
                  backgroundColor: 'var(--rmg-color-red)',
                  borderRadius: 'var(--rmg-radius-xs)',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 'var(--rmg-text-c1)',
                  lineHeight: 'var(--rmg-leading-c1)',
                  color: 'var(--rmg-color-text-light)',
                  fontFamily: 'var(--rmg-font-body)',
                }}
              >
                {px}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── BORDER RADIUS ──────────────────────────────────────────── */}
      <Section title="Border Radius">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--rmg-spacing-07)' }}>
          {[
            { name: 'xs',  token: '--rmg-radius-xs',  value: '4px' },
            { name: 's',   token: '--rmg-radius-s',   value: '8px' },
            { name: 'm',   token: '--rmg-radius-m',   value: '12px' },
            { name: 'l',   token: '--rmg-radius-l',   value: '24px' },
            { name: 'xl',  token: '--rmg-radius-xl',  value: '100px (pill)' },
          ].map(({ name, token, value }) => (
            <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--rmg-spacing-03)' }}>
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  backgroundColor: 'var(--rmg-color-red)',
                  borderRadius: `var(${token})`,
                }}
              />
              <span
                style={{
                  fontSize: 'var(--rmg-text-c1)',
                  lineHeight: 'var(--rmg-leading-c1)',
                  fontFamily: 'var(--rmg-font-body)',
                  color: 'var(--rmg-color-text-heading)',
                  fontWeight: 700,
                }}
              >
                radius-{name}
              </span>
              <span
                style={{
                  fontSize: 'var(--rmg-text-c2)',
                  lineHeight: 'var(--rmg-leading-c2)',
                  fontFamily: 'var(--rmg-font-body)',
                  color: 'var(--rmg-color-text-light)',
                }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── NOTIFICATION ───────────────────────────────────────────── */}
      <Section title="Notification">

        <ComponentSubheading>Banner</ComponentSubheading>
        {/* Negative margin lets the full-bleed bars break out of the page's 32px padding */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rmg-spacing-03)', marginBottom: 'var(--rmg-spacing-08)', margin: '0 calc(-1 * var(--rmg-spacing-07)) var(--rmg-spacing-08)' }}>
          <Notification variant="banner" status="warning" paddingX={32}
            title="Royal Mail strike"
            message="Strikes have been announced for Thursday XX, Friday XX and Saturday XX of July."
            onDismiss={() => {}} />
          <Notification variant="banner" status="information" paddingX={32}
            title="Royal Mail strike"
            message="Strikes have been announced for Thursday XX, Friday XX and Saturday XX of July."
            onDismiss={() => {}} />
          <Notification variant="banner" status="error" paddingX={32}
            title="Royal Mail strike"
            message="Strikes have been announced for Thursday XX, Friday XX and Saturday XX of July."
            onDismiss={() => {}} />
          <Notification variant="banner" status="success" paddingX={32}
            title="Royal Mail strike"
            message="Strikes have been announced for Thursday XX, Friday XX and Saturday XX of July."
            onDismiss={() => {}} />
          <Notification variant="banner" status="sustainability" paddingX={32}
            title="Royal Mail strike"
            message="Strikes have been announced for Thursday XX, Friday XX and Saturday XX of July."
            onDismiss={() => {}} />
        </div>

        <ComponentSubheading>Inline — with title</ComponentSubheading>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rmg-spacing-04)', maxWidth: 576, marginBottom: 'var(--rmg-spacing-08)' }}>
          <Notification variant="inline" status="warning"
            title="Royal Mail strike" message="Items posted before, during or after strike action will be delayed." />
          <Notification variant="inline" status="information"
            title="Royal Mail strike" message="Items posted before, during or after strike action will be delayed." />
          <Notification variant="inline" status="error"
            title="Royal Mail strike" message="Items posted before, during or after strike action will be delayed." />
          <Notification variant="inline" status="success"
            title="Royal Mail strike" message="Items posted before, during or after strike action will be delayed." />
          <Notification variant="inline" status="sustainability"
            title="Royal Mail strike" message="Items posted before, during or after strike action will be delayed." />
        </div>

        <ComponentSubheading>Inline — message only</ComponentSubheading>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rmg-spacing-04)', maxWidth: 576 }}>
          <Notification variant="inline" status="success"
            message="Items posted before, during or after strike action will be delayed." />
          <Notification variant="inline" status="information"
            message="Items posted before, during or after strike action will be delayed." />
        </div>

      </Section>

      {/* ── BREADCRUMB ─────────────────────────────────────────────── */}
      <Section title="Breadcrumb">
        {/* Negative margin breaks the full-bleed bar out of the page's 32px horizontal padding */}
        <div style={{ margin: '0 calc(-1 * var(--rmg-spacing-07))' }}>
          <Breadcrumb
            paddingX={32}
            items={[
              { label: 'Personal', href: '/' },
              { label: 'Sending', href: '/sending' },
              { label: 'Letters & parcels' },
            ]}
          />
        </div>
      </Section>

      {/* ── BUTTON ─────────────────────────────────────────────────── */}
      <Section title="Button">

        {/* Light background */}
        <ComponentSubheading>Solid — Light background</ComponentSubheading>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--rmg-spacing-06)', marginBottom: 'var(--rmg-spacing-08)' }}>
          <ButtonShowcase label="large">
            <Button variant="solid" size="large" background="light">Continue</Button>
          </ButtonShowcase>
          <ButtonShowcase label="medium">
            <Button variant="solid" size="medium" background="light">Continue</Button>
          </ButtonShowcase>
          <ButtonShowcase label="small">
            <Button variant="solid" size="small" background="light">Continue</Button>
          </ButtonShowcase>
          <ButtonShowcase label="disabled">
            <Button variant="solid" size="large" background="light" disabled>Continue</Button>
          </ButtonShowcase>
        </div>

        <ComponentSubheading>Outline — Light background</ComponentSubheading>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--rmg-spacing-06)', marginBottom: 'var(--rmg-spacing-08)' }}>
          <ButtonShowcase label="large">
            <Button variant="outline" size="large" background="light">Find out more</Button>
          </ButtonShowcase>
          <ButtonShowcase label="medium">
            <Button variant="outline" size="medium" background="light">Find out more</Button>
          </ButtonShowcase>
          <ButtonShowcase label="small">
            <Button variant="outline" size="small" background="light">Find out more</Button>
          </ButtonShowcase>
          <ButtonShowcase label="disabled">
            <Button variant="outline" size="large" background="light" disabled>Find out more</Button>
          </ButtonShowcase>
        </div>

        <ComponentSubheading>Link — Light background</ComponentSubheading>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--rmg-spacing-06)', marginBottom: 'var(--rmg-spacing-08)' }}>
          <ButtonShowcase label="large">
            <Button variant="link" size="large" background="light">Learn more</Button>
          </ButtonShowcase>
          <ButtonShowcase label="medium">
            <Button variant="link" size="medium" background="light">Learn more</Button>
          </ButtonShowcase>
          <ButtonShowcase label="small">
            <Button variant="link" size="small" background="light">Learn more</Button>
          </ButtonShowcase>
          <ButtonShowcase label="disabled">
            <Button variant="link" size="large" background="light" disabled>Learn more</Button>
          </ButtonShowcase>
        </div>

        {/* Dark background */}
        <div
          style={{
            backgroundColor: 'var(--rmg-color-red)',
            borderRadius: 'var(--rmg-radius-m)',
            padding: 'var(--rmg-spacing-08)',
            marginBottom: 'var(--rmg-spacing-04)',
          }}
        >
          <ComponentSubheading dark>Solid — Dark background</ComponentSubheading>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--rmg-spacing-06)', marginBottom: 'var(--rmg-spacing-08)' }}>
            <ButtonShowcase label="large" dark>
              <Button variant="solid" size="large" background="dark">Continue</Button>
            </ButtonShowcase>
            <ButtonShowcase label="medium" dark>
              <Button variant="solid" size="medium" background="dark">Continue</Button>
            </ButtonShowcase>
            <ButtonShowcase label="small" dark>
              <Button variant="solid" size="small" background="dark">Continue</Button>
            </ButtonShowcase>
            <ButtonShowcase label="disabled" dark>
              <Button variant="solid" size="large" background="dark" disabled>Continue</Button>
            </ButtonShowcase>
          </div>

          <ComponentSubheading dark>Outline — Dark background</ComponentSubheading>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--rmg-spacing-06)', marginBottom: 'var(--rmg-spacing-08)' }}>
            <ButtonShowcase label="large" dark>
              <Button variant="outline" size="large" background="dark">Find out more</Button>
            </ButtonShowcase>
            <ButtonShowcase label="medium" dark>
              <Button variant="outline" size="medium" background="dark">Find out more</Button>
            </ButtonShowcase>
            <ButtonShowcase label="small" dark>
              <Button variant="outline" size="small" background="dark">Find out more</Button>
            </ButtonShowcase>
            <ButtonShowcase label="disabled" dark>
              <Button variant="outline" size="large" background="dark" disabled>Find out more</Button>
            </ButtonShowcase>
          </div>

          <ComponentSubheading dark>Link — Dark background</ComponentSubheading>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--rmg-spacing-06)' }}>
            <ButtonShowcase label="large" dark>
              <Button variant="link" size="large" background="dark">Learn more</Button>
            </ButtonShowcase>
            <ButtonShowcase label="medium" dark>
              <Button variant="link" size="medium" background="dark">Learn more</Button>
            </ButtonShowcase>
            <ButtonShowcase label="small" dark>
              <Button variant="link" size="small" background="dark">Learn more</Button>
            </ButtonShowcase>
            <ButtonShowcase label="disabled" dark>
              <Button variant="link" size="large" background="dark" disabled>Learn more</Button>
            </ButtonShowcase>
          </div>
        </div>

      </Section>

      {/* ── CHEVRON BUTTON ─────────────────────────────────────────── */}
      <Section title="ChevronButton">

        <ComponentSubheading>Large (64 × 64 px)</ComponentSubheading>
        <div style={{ display: 'flex', gap: 'var(--rmg-spacing-08)', flexWrap: 'wrap', marginBottom: 'var(--rmg-spacing-08)' }}>
          <ButtonShowcase label="active · left">
            <ChevronButton size="large" direction="left" state="active" />
          </ButtonShowcase>
          <ButtonShowcase label="active · right">
            <ChevronButton size="large" direction="right" state="active" />
          </ButtonShowcase>
          <ButtonShowcase label="disabled · left">
            <ChevronButton size="large" direction="left" state="disabled" />
          </ButtonShowcase>
          <ButtonShowcase label="disabled · right">
            <ChevronButton size="large" direction="right" state="disabled" />
          </ButtonShowcase>
        </div>

        <ComponentSubheading>Small (48 × 48 px)</ComponentSubheading>
        <div style={{ display: 'flex', gap: 'var(--rmg-spacing-08)', flexWrap: 'wrap' }}>
          <ButtonShowcase label="active · left">
            <ChevronButton size="small" direction="left" state="active" />
          </ButtonShowcase>
          <ButtonShowcase label="active · right">
            <ChevronButton size="small" direction="right" state="active" />
          </ButtonShowcase>
          <ButtonShowcase label="disabled · left">
            <ChevronButton size="small" direction="left" state="disabled" />
          </ButtonShowcase>
          <ButtonShowcase label="disabled · right">
            <ChevronButton size="small" direction="right" state="disabled" />
          </ButtonShowcase>
        </div>

      </Section>

      {/* ── FORM FIELD ─────────────────────────────────────────────── */}
      <Section title="FormField">

        <ComponentSubheading>Large — Variants</ComponentSubheading>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--rmg-spacing-07)', marginBottom: 'var(--rmg-spacing-09)' }}>
          <FieldShowcase label="default · empty">
            <FormField size="large" label="Postcode" type="text" placeholder="e.g. EC1A 1BB" />
          </FieldShowcase>
          <FieldShowcase label="default · filled">
            <FormField size="large" label="Postcode" type="text" defaultValue="SW1A 2AA" />
          </FieldShowcase>
          <FieldShowcase label="validated">
            <FormField size="large" label="Postcode" variant="validated" type="text" defaultValue="SW1A 2AA" />
          </FieldShowcase>
          <FieldShowcase label="error">
            <FormField size="large" label="Postcode" variant="error" type="text" defaultValue="SW1X" errorMessage="Enter a valid UK postcode" />
          </FieldShowcase>
          <FieldShowcase label="disabled">
            <FormField size="large" label="Postcode" variant="disabled" type="text" defaultValue="SW1A 2AA" />
          </FieldShowcase>
          <FieldShowcase label="required">
            <FormField size="large" label="Postcode" required type="text" placeholder="e.g. EC1A 1BB" />
          </FieldShowcase>
        </div>

        <ComponentSubheading>Large — Types</ComponentSubheading>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--rmg-spacing-07)', marginBottom: 'var(--rmg-spacing-09)' }}>
          <FieldShowcase label="text">
            <FormField size="large" label="Postcode" type="text" placeholder="e.g. EC1A 1BB" />
          </FieldShowcase>
          <FieldShowcase label="dropdown">
            <FormField size="large" label="Parcel type" type="dropdown" placeholder="Select parcel type" />
          </FieldShowcase>
          <FieldShowcase label="date">
            <FormField size="large" label="Delivery date" type="date" />
          </FieldShowcase>
        </div>

        <ComponentSubheading>Small — Variants</ComponentSubheading>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--rmg-spacing-07)', marginBottom: 'var(--rmg-spacing-09)' }}>
          <FieldShowcase label="default · empty">
            <FormField size="small" label="Postcode" type="text" placeholder="e.g. EC1A 1BB" />
          </FieldShowcase>
          <FieldShowcase label="default · filled">
            <FormField size="small" label="Postcode" type="text" defaultValue="SW1A 2AA" />
          </FieldShowcase>
          <FieldShowcase label="validated">
            <FormField size="small" label="Postcode" variant="validated" type="text" defaultValue="SW1A 2AA" />
          </FieldShowcase>
          <FieldShowcase label="error">
            <FormField size="small" label="Postcode" variant="error" type="text" defaultValue="SW1X" errorMessage="Enter a valid UK postcode" />
          </FieldShowcase>
          <FieldShowcase label="disabled">
            <FormField size="small" label="Postcode" variant="disabled" type="text" defaultValue="SW1A 2AA" />
          </FieldShowcase>
          <FieldShowcase label="required">
            <FormField size="small" label="Postcode" required type="text" placeholder="e.g. EC1A 1BB" />
          </FieldShowcase>
        </div>

        <ComponentSubheading>Small — Types</ComponentSubheading>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--rmg-spacing-07)' }}>
          <FieldShowcase label="text">
            <FormField size="small" label="Postcode" type="text" placeholder="e.g. EC1A 1BB" />
          </FieldShowcase>
          <FieldShowcase label="dropdown">
            <FormField size="small" label="Parcel type" type="dropdown" placeholder="Select parcel type" />
          </FieldShowcase>
          <FieldShowcase label="date">
            <FormField size="small" label="Delivery date" type="date" />
          </FieldShowcase>
        </div>

      </Section>

      {/* ── CHECKBOX ───────────────────────────────────────────────── */}
      <Section title="Checkbox">

        <ComponentSubheading>Large</ComponentSubheading>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--rmg-spacing-08)', marginBottom: 'var(--rmg-spacing-08)' }}>
          <FieldShowcase label="default">
            <Checkbox label="Default" size="large" />
          </FieldShowcase>
          <FieldShowcase label="checked">
            <Checkbox label="Checked" size="large" defaultChecked />
          </FieldShowcase>
          <FieldShowcase label="disabled">
            <Checkbox label="Disabled" size="large" disabled />
          </FieldShowcase>
          <FieldShowcase label="error">
            <Checkbox label="Error" size="large" state="error" errorMessage="Error message" />
          </FieldShowcase>
          <FieldShowcase label="success">
            <Checkbox label="Success" size="large" state="success" defaultChecked />
          </FieldShowcase>
        </div>

        <ComponentSubheading>Small</ComponentSubheading>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--rmg-spacing-08)' }}>
          <FieldShowcase label="default">
            <Checkbox label="Default" size="small" />
          </FieldShowcase>
          <FieldShowcase label="checked">
            <Checkbox label="Checked" size="small" defaultChecked />
          </FieldShowcase>
          <FieldShowcase label="disabled">
            <Checkbox label="Disabled" size="small" disabled />
          </FieldShowcase>
          <FieldShowcase label="error">
            <Checkbox label="Error" size="small" state="error" errorMessage="Error message" />
          </FieldShowcase>
          <FieldShowcase label="success">
            <Checkbox label="Success" size="small" state="success" defaultChecked />
          </FieldShowcase>
        </div>

      </Section>

      {/* ── RADIO ──────────────────────────────────────────────────── */}
      <Section title="Radio">

        <ComponentSubheading>Large</ComponentSubheading>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--rmg-spacing-08)', marginBottom: 'var(--rmg-spacing-08)' }}>
          <FieldShowcase label="default">
            <Radio label="Default" size="large" />
          </FieldShowcase>
          <FieldShowcase label="selected">
            <Radio label="Selected" size="large" defaultChecked />
          </FieldShowcase>
          <FieldShowcase label="disabled">
            <Radio label="Disabled" size="large" state="disabled" />
          </FieldShowcase>
          <FieldShowcase label="disabled · selected">
            <Radio label="Disabled" size="large" state="disabled" defaultChecked />
          </FieldShowcase>
          <FieldShowcase label="error">
            <Radio label="Error" size="large" state="error" errorMessage="Error message" />
          </FieldShowcase>
          <FieldShowcase label="success">
            <Radio label="Success" size="large" state="success" />
          </FieldShowcase>
        </div>

        <ComponentSubheading>Small</ComponentSubheading>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--rmg-spacing-08)', marginBottom: 'var(--rmg-spacing-08)' }}>
          <FieldShowcase label="default">
            <Radio label="Default" size="small" />
          </FieldShowcase>
          <FieldShowcase label="selected">
            <Radio label="Selected" size="small" defaultChecked />
          </FieldShowcase>
          <FieldShowcase label="disabled">
            <Radio label="Disabled" size="small" state="disabled" />
          </FieldShowcase>
          <FieldShowcase label="disabled · selected">
            <Radio label="Disabled" size="small" state="disabled" defaultChecked />
          </FieldShowcase>
          <FieldShowcase label="error">
            <Radio label="Error" size="small" state="error" errorMessage="Error message" />
          </FieldShowcase>
          <FieldShowcase label="success">
            <Radio label="Success" size="small" state="success" />
          </FieldShowcase>
        </div>

        <ComponentSubheading>Group — mutual exclusivity</ComponentSubheading>
        <RadioGroupDemo />

      </Section>

      {/* ── NAVBAR ─────────────────────────────────────────────────── */}
      <Section title="NavBar">

        <ComponentSubheading>Logged out</ComponentSubheading>
        <div style={{ margin: '0 calc(-1 * var(--rmg-spacing-07))', marginBottom: 'var(--rmg-spacing-06)' }}>
          <NavBar
            logoSlot={<NavBarLogoPlaceholder />}
            items={NAV_DEMO_ITEMS}
            variant="logged-out"
            onCtaClick={() => {}}
            onAuthClick={() => {}}
            onSearchClick={() => {}}
            onMenuOpen={() => {}}
          />
        </div>

        <ComponentSubheading>Logged in</ComponentSubheading>
        <div style={{ margin: '0 calc(-1 * var(--rmg-spacing-07))' }}>
          <NavBar
            logoSlot={<NavBarLogoPlaceholder />}
            items={NAV_DEMO_ITEMS}
            variant="logged-in"
            onCtaClick={() => {}}
            onAuthClick={() => {}}
            onSearchClick={() => {}}
            onMenuOpen={() => {}}
          />
        </div>

      </Section>

      {/* ── STEPPER ────────────────────────────────────────────────── */}
      <Section title="Stepper">
        <StepperDemo />
      </Section>

      {/* ── TABS ───────────────────────────────────────────────────── */}
      <Section title="Tabs">

        <ComponentSubheading>Desktop + Tablet</ComponentSubheading>
        <div style={{ marginBottom: 'var(--rmg-spacing-08)' }}>
          <TabsDesktopDemo />
        </div>

        <ComponentSubheading>Mobile</ComponentSubheading>
        <div style={{ maxWidth: 375 }}>
          <TabsMobileDemo />
        </div>

      </Section>

      {/* ── SHADOWS ────────────────────────────────────────────────── */}
      <Section title="Shadows">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--rmg-spacing-08)' }}>
          {[
            { name: 'shadow-card',     token: '--rmg-shadow-card',     label: 'Card', desc: '0 4px 56px rgba(0,0,0,0.08)' },
            { name: 'shadow-megamenu', token: '--rmg-shadow-megamenu', label: 'Megamenu', desc: '0 4px 16px rgba(0,0,0,0.20)' },
            { name: 'shadow-header',   token: '--rmg-shadow-header',   label: 'Header', desc: '0 2px 12px rgba(0,0,0,0.08)' },
          ].map(({ name, token, label, desc }) => (
            <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rmg-spacing-04)' }}>
              <div
                style={{
                  width: '200px',
                  height: '120px',
                  backgroundColor: 'var(--rmg-color-surface-white)',
                  borderRadius: 'var(--rmg-radius-m)',
                  boxShadow: `var(${token})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: 'var(--rmg-text-c1)',
                    lineHeight: 'var(--rmg-leading-c1)',
                    fontFamily: 'var(--rmg-font-body)',
                    color: 'var(--rmg-color-text-light)',
                  }}
                >
                  {label}
                </span>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 'var(--rmg-text-c1)',
                    lineHeight: 'var(--rmg-leading-c1)',
                    fontFamily: 'var(--rmg-font-body)',
                    color: 'var(--rmg-color-text-heading)',
                    fontWeight: 700,
                  }}
                >
                  {name}
                </div>
                <div
                  style={{
                    fontSize: 'var(--rmg-text-c2)',
                    lineHeight: 'var(--rmg-leading-c2)',
                    fontFamily: 'var(--rmg-font-body)',
                    color: 'var(--rmg-color-text-light)',
                  }}
                >
                  {desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── ICONS ──────────────────────────────────────────────────── */}
      <Section title="Icons">

        {(
          [
            { label: 'Directional', names: ['chevron-right', 'chevron-left', 'chevron-up', 'chevron-down', 'chevron-right-sm', 'chevron-left-sm', 'chevron-up-sm', 'chevron-down-sm', 'arrow-right'] },
            { label: 'UI Actions',  names: ['close', 'edit', 'check'] },
            { label: 'Informational', names: ['info', 'location'] },
          ] as Array<{ label: string; names: IconName[] }>
        ).map(({ label, names }) => (
          <div key={label}>
            <div
              style={{
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 'var(--rmg-text-c1)',
                lineHeight: 'var(--rmg-leading-c1)',
                color: 'var(--rmg-color-text-light)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 'var(--rmg-spacing-04)',
              }}
            >
              {label}
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--rmg-spacing-03)',
                marginBottom: 'var(--rmg-spacing-07)',
              }}
            >
              {names.map((name) => (
                <div
                  key={name}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 'var(--rmg-spacing-02)',
                    padding: 'var(--rmg-spacing-04) var(--rmg-spacing-03)',
                    background: 'var(--rmg-color-grey-4)',
                    borderRadius: 'var(--rmg-radius-s)',
                    width: '96px',
                  }}
                >
                  <Icon name={name} size={20} color="var(--rmg-color-red)" />
                  <span
                    style={{
                      fontFamily: 'var(--rmg-font-body)',
                      fontSize: 'var(--rmg-text-c2)',
                      lineHeight: 'var(--rmg-leading-c2)',
                      color: 'var(--rmg-color-text-light)',
                      textAlign: 'center',
                    }}
                  >
                    {name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Colour context */}
        <div>
          <div
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-c1)',
              lineHeight: 'var(--rmg-leading-c1)',
              color: 'var(--rmg-color-text-light)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 'var(--rmg-spacing-04)',
            }}
          >
            Colour context — icons use currentColor
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--rmg-spacing-03)' }}>
            {(
              [
                { color: 'var(--rmg-color-red)',            label: 'red' },
                { color: 'var(--rmg-color-grey-1)',         label: 'grey-1' },
                { color: 'var(--rmg-color-black)',          label: 'black' },
                { color: 'var(--rmg-color-green-contrast)', label: 'green-contrast' },
                { color: 'var(--rmg-color-blue)',           label: 'blue' },
              ] as Array<{ color: string; label: string }>
            ).map(({ color, label }) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--rmg-spacing-02)',
                  padding: 'var(--rmg-spacing-04) var(--rmg-spacing-03)',
                  background: 'var(--rmg-color-grey-4)',
                  borderRadius: 'var(--rmg-radius-s)',
                  width: '80px',
                }}
              >
                <Icon name="arrow-right" size={20} color={color} />
                <span
                  style={{
                    fontFamily: 'var(--rmg-font-body)',
                    fontSize: 'var(--rmg-text-c2)',
                    lineHeight: 'var(--rmg-leading-c2)',
                    color: 'var(--rmg-color-text-light)',
                    textAlign: 'center',
                  }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

      </Section>

    </div>
  )
}

/* ── Sub-components ────────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 'var(--rmg-spacing-12)' }}>
      <h2
        style={{
          fontFamily: 'var(--rmg-font-display)',
          fontSize: 'var(--rmg-text-h3)',
          lineHeight: 'var(--rmg-leading-h3)',
          color: 'var(--rmg-color-text-heading)',
          marginBottom: 'var(--rmg-spacing-07)',
          paddingBottom: 'var(--rmg-spacing-04)',
          borderBottom: '2px solid var(--rmg-color-red)',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

function ColourGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--rmg-spacing-07)' }}>
      <h3
        style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-c1)',
          lineHeight: 'var(--rmg-leading-c1)',
          color: 'var(--rmg-color-text-light)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 'var(--rmg-spacing-04)',
        }}
      >
        {label}
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--rmg-spacing-04)' }}>
        {children}
      </div>
    </div>
  )
}

function Swatch({
  name,
  token,
  hex,
  dark = false,
  border = false,
}: {
  name: string
  token: string
  hex: string
  dark?: boolean
  border?: boolean
}) {
  return (
    <div style={{ width: '120px' }}>
      <div
        style={{
          width: '120px',
          height: '72px',
          backgroundColor: `var(${token})`,
          borderRadius: 'var(--rmg-radius-s)',
          marginBottom: 'var(--rmg-spacing-02)',
          border: border ? '1px solid var(--rmg-color-grey-2)' : 'none',
        }}
      />
      <div
        style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-c1)',
          lineHeight: 'var(--rmg-leading-c1)',
          color: 'var(--rmg-color-text-heading)',
          fontWeight: 700,
        }}
      >
        {name}
      </div>
      <div
        style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-c2)',
          lineHeight: 'var(--rmg-leading-c2)',
          color: 'var(--rmg-color-text-light)',
        }}
      >
        {hex}
      </div>
      <div
        style={{
          fontFamily: 'monospace',
          fontSize: 'var(--rmg-text-c2)',
          lineHeight: 'var(--rmg-leading-c2)',
          color: 'var(--rmg-color-text-light)',
          overflowWrap: 'break-word',
        }}
      >
        {token}
      </div>
    </div>
  )
}

function TypeLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 'var(--rmg-text-c1)',
        lineHeight: 'var(--rmg-leading-c1)',
        color: 'var(--rmg-color-text-light)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}
    >
      {children}
    </span>
  )
}

function TypeSample({
  label,
  sizeToken,
  leadToken,
  family,
  sample,
}: {
  label: string
  sizeToken: string
  leadToken: string
  family: string
  sample: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 'var(--rmg-spacing-06)',
        paddingBottom: 'var(--rmg-spacing-05)',
        borderBottom: '1px solid var(--rmg-color-grey-3)',
        marginBottom: 'var(--rmg-spacing-05)',
      }}
    >
      <div
        style={{
          width: '48px',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-c1)',
            lineHeight: 'var(--rmg-leading-c1)',
            color: 'var(--rmg-color-text-light)',
            fontWeight: 700,
          }}
        >
          {label}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: family,
            fontSize: `var(${sizeToken})`,
            lineHeight: `var(${leadToken})`,
            color: 'var(--rmg-color-text-heading)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {sample}
        </div>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 'var(--rmg-text-c2)',
            lineHeight: 'var(--rmg-leading-c2)',
            color: 'var(--rmg-color-text-light)',
          }}
        >
          {sizeToken}
        </div>
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 'var(--rmg-text-c2)',
            lineHeight: 'var(--rmg-leading-c2)',
            color: 'var(--rmg-color-text-light)',
          }}
        >
          {leadToken}
        </div>
      </div>
    </div>
  )
}

function ComponentSubheading({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div
      style={{
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 'var(--rmg-text-c1)',
        lineHeight: 'var(--rmg-leading-c1)',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase' as const,
        color: dark ? 'rgba(255,255,255,0.6)' : 'var(--rmg-color-text-light)',
        marginBottom: 'var(--rmg-spacing-05)',
      }}
    >
      {children}
    </div>
  )
}

function ButtonShowcase({ label, children, dark = false }: { label: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--rmg-spacing-03)' }}>
      {children}
      <span
        style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-c2)',
          lineHeight: 'var(--rmg-leading-c2)',
          color: dark ? 'rgba(255,255,255,0.6)' : 'var(--rmg-color-text-light)',
        }}
      >
        {label}
      </span>
    </div>
  )
}

function FieldShowcase({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rmg-spacing-02)' }}>
      <span
        style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-c2)',
          lineHeight: 'var(--rmg-leading-c2)',
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase' as const,
          color: 'var(--rmg-color-text-light)',
        }}
      >
        {label}
      </span>
      {children}
    </div>
  )
}
