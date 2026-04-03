import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useAuth } from "@/hooks/useAuth";
import {
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_TAGS,
  CONDITIONS,
  STORAGE_SIZES,
  HOUSING_AMENITIES,
  BEDROOM_OPTIONS,
  BATHROOM_OPTIONS,
  LEASE_DURATION_OPTIONS,
  NEIGHBORHOODS,
} from "@uchicago-marketplace/shared";
import { colors, getAccentColor } from "@/constants/colors";
import { StepIndicator } from "@/components/StepIndicator";
import { ImagePickerGrid } from "@/components/ImagePickerGrid";
import { TypeSelector } from "@/components/TypeSelector";
import { useCreatePost, type CreatePostState } from "@/hooks/useCreatePost";

const STEPS = ["Photos", "Type", "Info", "Details", "Review"];

/* ────────────────────────────────────────────────────
 * Local helper components
 * ──────────────────────────────────────────────────── */

function ToggleRow({
  options,
  selected,
  onSelect,
  accentColor,
}: {
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
  accentColor?: string;
}) {
  const accent = accentColor || colors.maroon[600];
  return (
    <View style={toggleStyles.row}>
      {options.map((opt) => {
        const isActive = opt.value === selected;
        return (
          <Pressable
            key={opt.value}
            style={[
              toggleStyles.btn,
              isActive && { backgroundColor: accent, borderColor: accent },
            ]}
            onPress={() => onSelect(opt.value)}
          >
            <Text
              style={[
                toggleStyles.btnText,
                isActive && { color: colors.white },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const toggleStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.gray[200],
    alignItems: "center",
  },
  btnText: { fontSize: 14, fontWeight: "600", color: colors.gray[600] },
});

function ReviewRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={reviewStyles.row}>
      <Text style={reviewStyles.label}>{label}</Text>
      <Text style={reviewStyles.value}>{value}</Text>
    </View>
  );
}

const reviewStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  label: { fontSize: 13, color: colors.gray[500], flex: 1 },
  value: { fontSize: 13, fontWeight: "600", color: colors.gray[900], flex: 1.5, textAlign: "right" },
});

function ChipPicker({
  options,
  selected,
  onSelect,
  accentColor,
  multi = false,
  selectedMulti,
  onToggleMulti,
}: {
  options: readonly { value: string; label: string }[];
  selected?: string;
  onSelect?: (value: string) => void;
  accentColor?: string;
  multi?: boolean;
  selectedMulti?: string[];
  onToggleMulti?: (value: string) => void;
}) {
  const accent = accentColor || colors.maroon[600];
  return (
    <View style={chipStyles.container}>
      {options.map((opt) => {
        const isActive = multi
          ? selectedMulti?.includes(opt.value)
          : selected === opt.value;
        return (
          <Pressable
            key={opt.value}
            style={[
              chipStyles.chip,
              isActive && { backgroundColor: colors.maroon[50], borderColor: accent },
            ]}
            onPress={() => {
              if (multi && onToggleMulti) onToggleMulti(opt.value);
              else if (onSelect) onSelect(opt.value);
            }}
          >
            <Text
              style={[chipStyles.chipText, isActive && { color: accent }]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  container: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.gray[200],
    backgroundColor: colors.white,
  },
  chipText: { fontSize: 13, fontWeight: "500", color: colors.gray[600] },
});

function SectionLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <Text style={sectionStyles.label}>
      {text}
      {required && <Text style={sectionStyles.asterisk}> *</Text>}
    </Text>
  );
}

const sectionStyles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: "600", color: colors.gray[800], marginBottom: 6 },
  asterisk: { color: colors.error },
});

/* ────────────────────────────────────────────────────
 * Step content components
 * ──────────────────────────────────────────────────── */

function StepPhotos({
  state,
  update,
}: {
  state: CreatePostState;
  update: (p: Partial<CreatePostState>) => void;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Add Photos</Text>
      <Text style={styles.stepSubtitle}>
        Photos help your post get more attention
      </Text>
      <ImagePickerGrid
        images={state.images}
        onImagesChange={(images) => update({ images })}
      />
    </View>
  );
}

function StepType({
  state,
  update,
}: {
  state: CreatePostState;
  update: (p: Partial<CreatePostState>) => void;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>What are you posting?</Text>
      <TypeSelector
        selectedType={state.type}
        onSelectType={(type) => {
          const t = type as CreatePostState["type"];
          const sideDefaults: Record<string, string> = {
            marketplace: "sell",
            storage: "has_space",
            housing: "offering",
          };
          update({
            type: t,
            side: sideDefaults[type] || "sell",
            housingSubtype: t !== "housing" ? null : state.housingSubtype,
          });
        }}
        selectedSubtype={state.housingSubtype}
        onSelectSubtype={(subtype) =>
          update({ housingSubtype: subtype as "sublet" | "passdown" })
        }
      />
    </View>
  );
}

function StepBasicInfo({
  state,
  update,
}: {
  state: CreatePostState;
  update: (p: Partial<CreatePostState>) => void;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Basic Info</Text>

      <View>
        <SectionLabel text="Title" required />
        <TextInput
          style={styles.input}
          placeholder="What are you posting?"
          placeholderTextColor={colors.gray[400]}
          value={state.title}
          onChangeText={(title) => update({ title })}
          maxLength={80}
        />
        <Text style={styles.charCounter}>{state.title.length}/80</Text>
      </View>

      <View>
        <SectionLabel text="Description" />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Add details to help others understand your post..."
          placeholderTextColor={colors.gray[400]}
          value={state.description}
          onChangeText={(description) => update({ description })}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>
    </View>
  );
}

/* ── Step 4: Type-specific detail components ── */

function MarketplaceFields({
  state,
  update,
  accent,
}: {
  state: CreatePostState;
  update: (p: Partial<CreatePostState>) => void;
  accent: string;
}) {
  const categoryChips = MARKETPLACE_CATEGORIES.map((c) => ({
    value: c,
    label: c,
  }));
  const tagChips = MARKETPLACE_TAGS.map((t) => ({ value: t, label: t }));

  return (
    <View style={styles.stepContent}>
      <SectionLabel text="Side" required />
      <ToggleRow
        options={[
          { value: "sell", label: "Selling" },
          { value: "buy", label: "Buying" },
        ]}
        selected={state.side}
        onSelect={(side) => update({ side })}
        accentColor={accent}
      />

      <SectionLabel text="Category" required />
      <ChipPicker
        options={categoryChips}
        selected={state.category}
        onSelect={(category) => update({ category })}
        accentColor={accent}
      />

      <SectionLabel text="Condition" required />
      <ChipPicker
        options={CONDITIONS}
        selected={state.condition}
        onSelect={(condition) => update({ condition })}
        accentColor={accent}
      />

      <SectionLabel text="Price Type" required />
      <ToggleRow
        options={[
          { value: "fixed", label: "Fixed" },
          { value: "free", label: "Free" },
          { value: "trade", label: "Trade" },
        ]}
        selected={state.priceType}
        onSelect={(priceType) =>
          update({ priceType: priceType as "fixed" | "free" | "trade" })
        }
        accentColor={accent}
      />

      {state.priceType === "fixed" && (
        <View>
          <SectionLabel text="Price ($)" required />
          <TextInput
            style={styles.input}
            placeholder="0.00"
            placeholderTextColor={colors.gray[400]}
            value={state.priceAmount}
            onChangeText={(priceAmount) => update({ priceAmount })}
            keyboardType="decimal-pad"
          />
        </View>
      )}

      {state.priceType === "trade" && (
        <View>
          <SectionLabel text="What do you want to trade for?" required />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe what you'd like in return..."
            placeholderTextColor={colors.gray[400]}
            value={state.tradeDescription}
            onChangeText={(tradeDescription) => update({ tradeDescription })}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      )}

      <SectionLabel text="Tags" />
      <ChipPicker
        options={tagChips}
        multi
        selectedMulti={state.tags}
        onToggleMulti={(tag) => {
          const next = state.tags.includes(tag)
            ? state.tags.filter((t) => t !== tag)
            : [...state.tags, tag];
          update({ tags: next });
        }}
        accentColor={accent}
      />
    </View>
  );
}

function StorageFields({
  state,
  update,
  accent,
}: {
  state: CreatePostState;
  update: (p: Partial<CreatePostState>) => void;
  accent: string;
}) {
  return (
    <View style={styles.stepContent}>
      <SectionLabel text="Side" required />
      <ToggleRow
        options={[
          { value: "has_space", label: "Has Space" },
          { value: "need_storage", label: "Need Storage" },
        ]}
        selected={state.side}
        onSelect={(side) => update({ side })}
        accentColor={accent}
      />

      <SectionLabel text="Start Date" required />
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.gray[400]}
        value={state.startDate}
        onChangeText={(startDate) => update({ startDate })}
      />

      <SectionLabel text="End Date" required />
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.gray[400]}
        value={state.endDate}
        onChangeText={(endDate) => update({ endDate })}
      />

      <SectionLabel text="Size" required />
      <ChipPicker
        options={STORAGE_SIZES}
        selected={state.size}
        onSelect={(size) => update({ size })}
        accentColor={accent}
      />

      <SectionLabel text="Location" required />
      <ToggleRow
        options={[
          { value: "on_campus", label: "On Campus" },
          { value: "off_campus", label: "Off Campus" },
        ]}
        selected={state.locationType}
        onSelect={(locationType) => update({ locationType })}
        accentColor={accent}
      />

      <SectionLabel text="Neighborhood" />
      <TextInput
        style={styles.input}
        placeholder="e.g. Hyde Park"
        placeholderTextColor={colors.gray[400]}
        value={state.neighborhood}
        onChangeText={(neighborhood) => update({ neighborhood })}
      />

      <View style={freeCheckStyles.row}>
        <Pressable
          style={[
            freeCheckStyles.box,
            state.isFree && { backgroundColor: accent, borderColor: accent },
          ]}
          onPress={() => update({ isFree: !state.isFree })}
        >
          {state.isFree && (
            <Text style={freeCheckStyles.check}>{"\u2713"}</Text>
          )}
        </Pressable>
        <Text style={freeCheckStyles.label}>Free storage</Text>
      </View>

      {!state.isFree && (
        <View>
          <SectionLabel text="Monthly Price ($)" required />
          <TextInput
            style={styles.input}
            placeholder="0.00"
            placeholderTextColor={colors.gray[400]}
            value={state.priceMonthly}
            onChangeText={(priceMonthly) => update({ priceMonthly })}
            keyboardType="decimal-pad"
          />
        </View>
      )}

      <SectionLabel text="Restrictions" />
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Any restrictions or notes..."
        placeholderTextColor={colors.gray[400]}
        value={state.restrictions}
        onChangeText={(restrictions) => update({ restrictions })}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />
    </View>
  );
}

const freeCheckStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.gray[300],
    alignItems: "center",
    justifyContent: "center",
  },
  check: { fontSize: 14, color: colors.white, fontWeight: "700" },
  label: { fontSize: 14, color: colors.gray[700] },
});

function HousingFields({
  state,
  update,
  accent,
}: {
  state: CreatePostState;
  update: (p: Partial<CreatePostState>) => void;
  accent: string;
}) {
  const neighborhoodChips = NEIGHBORHOODS.map((n) => ({ value: n, label: n }));

  return (
    <View style={styles.stepContent}>
      <SectionLabel text="Side" required />
      <ToggleRow
        options={[
          { value: "offering", label: "Offering" },
          { value: "looking", label: "Looking" },
        ]}
        selected={state.side}
        onSelect={(side) => update({ side })}
        accentColor={accent}
      />

      <SectionLabel text="Monthly Rent ($)" required />
      <TextInput
        style={styles.input}
        placeholder="0"
        placeholderTextColor={colors.gray[400]}
        value={state.monthlyRent}
        onChangeText={(monthlyRent) => update({ monthlyRent })}
        keyboardType="number-pad"
      />

      {state.housingSubtype === "sublet" && (
        <>
          <SectionLabel text="Move-in Date" required />
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.gray[400]}
            value={state.moveInDate}
            onChangeText={(moveInDate) => update({ moveInDate })}
          />

          <SectionLabel text="Move-out Date" required />
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.gray[400]}
            value={state.moveOutDate}
            onChangeText={(moveOutDate) => update({ moveOutDate })}
          />
        </>
      )}

      {state.housingSubtype === "passdown" && (
        <>
          <SectionLabel text="Lease Start Date" required />
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.gray[400]}
            value={state.leaseStartDate}
            onChangeText={(leaseStartDate) => update({ leaseStartDate })}
          />

          <SectionLabel text="Lease Duration" required />
          <ChipPicker
            options={LEASE_DURATION_OPTIONS.map((o) => ({
              value: String(o.value),
              label: o.label,
            }))}
            selected={state.leaseDurationMonths}
            onSelect={(leaseDurationMonths) => update({ leaseDurationMonths })}
            accentColor={accent}
          />
        </>
      )}

      <SectionLabel text="Bedrooms" required />
      <ChipPicker
        options={BEDROOM_OPTIONS}
        selected={state.bedrooms}
        onSelect={(bedrooms) => update({ bedrooms })}
        accentColor={accent}
      />

      <SectionLabel text="Bathrooms" required />
      <ChipPicker
        options={BATHROOM_OPTIONS}
        selected={state.bathrooms}
        onSelect={(bathrooms) => update({ bathrooms })}
        accentColor={accent}
      />

      <SectionLabel text="Neighborhood" />
      <ChipPicker
        options={neighborhoodChips}
        selected={state.neighborhood}
        onSelect={(neighborhood) => update({ neighborhood })}
        accentColor={accent}
      />

      <SectionLabel text="Amenities" />
      <ChipPicker
        options={HOUSING_AMENITIES}
        multi
        selectedMulti={state.amenities}
        onToggleMulti={(amenity) => {
          const next = state.amenities.includes(amenity)
            ? state.amenities.filter((a) => a !== amenity)
            : [...state.amenities, amenity];
          update({ amenities: next });
        }}
        accentColor={accent}
      />

      <SectionLabel text="Roommates" />
      <ToggleRow
        options={[
          { value: "solo", label: "Solo" },
          { value: "shared", label: "Shared" },
        ]}
        selected={state.roommates}
        onSelect={(roommates) => update({ roommates })}
        accentColor={accent}
      />

      {state.roommates === "shared" && (
        <View>
          <SectionLabel text="Number of Roommates" />
          <TextInput
            style={styles.input}
            placeholder="1"
            placeholderTextColor={colors.gray[400]}
            value={state.roommateCount}
            onChangeText={(roommateCount) => update({ roommateCount })}
            keyboardType="number-pad"
          />
        </View>
      )}
    </View>
  );
}

function StepTypeDetails({
  state,
  update,
}: {
  state: CreatePostState;
  update: (p: Partial<CreatePostState>) => void;
}) {
  const accent = state.type ? getAccentColor(state.type) : colors.maroon[600];

  return (
    <View>
      <Text style={[styles.stepTitle, { paddingHorizontal: 16 }]}>
        {state.type === "marketplace"
          ? "Marketplace Details"
          : state.type === "storage"
            ? "Storage Details"
            : "Housing Details"}
      </Text>

      {state.type === "marketplace" && (
        <MarketplaceFields state={state} update={update} accent={accent} />
      )}
      {state.type === "storage" && (
        <StorageFields state={state} update={update} accent={accent} />
      )}
      {state.type === "housing" && (
        <HousingFields state={state} update={update} accent={accent} />
      )}
    </View>
  );
}

/* ── Step 5: Review ── */

function StepReview({ state }: { state: CreatePostState }) {
  const conditionLabel =
    CONDITIONS.find((c) => c.value === state.condition)?.label || state.condition;
  const sizeLabel =
    STORAGE_SIZES.find((s) => s.value === state.size)?.label || state.size;
  const bedroomsLabel =
    BEDROOM_OPTIONS.find((b) => b.value === state.bedrooms)?.label || state.bedrooms;
  const bathroomsLabel =
    BATHROOM_OPTIONS.find((b) => b.value === state.bathrooms)?.label || state.bathrooms;
  const durationLabel =
    LEASE_DURATION_OPTIONS.find(
      (o) => String(o.value) === state.leaseDurationMonths
    )?.label || (state.leaseDurationMonths ? `${state.leaseDurationMonths} months` : "");

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Review Your Post</Text>

      <ReviewRow label="Photos" value={`${state.images.length} photo${state.images.length !== 1 ? "s" : ""}`} />
      <ReviewRow label="Type" value={state.type || ""} />
      {state.type === "housing" && (
        <ReviewRow label="Subtype" value={state.housingSubtype || ""} />
      )}
      <ReviewRow label="Title" value={state.title} />
      {state.description ? (
        <ReviewRow label="Description" value={state.description} />
      ) : null}

      {state.type === "marketplace" && (
        <>
          <ReviewRow label="Side" value={state.side === "sell" ? "Selling" : "Buying"} />
          <ReviewRow label="Category" value={state.category} />
          <ReviewRow label="Condition" value={conditionLabel} />
          <ReviewRow label="Price Type" value={state.priceType} />
          {state.priceType === "fixed" && (
            <ReviewRow label="Price" value={`$${state.priceAmount}`} />
          )}
          {state.priceType === "trade" && (
            <ReviewRow label="Trade For" value={state.tradeDescription} />
          )}
          {state.tags.length > 0 && (
            <ReviewRow label="Tags" value={state.tags.join(", ")} />
          )}
        </>
      )}

      {state.type === "storage" && (
        <>
          <ReviewRow label="Side" value={state.side === "has_space" ? "Has Space" : "Need Storage"} />
          <ReviewRow label="Dates" value={`${state.startDate} to ${state.endDate}`} />
          <ReviewRow label="Size" value={sizeLabel} />
          <ReviewRow label="Location" value={state.locationType === "on_campus" ? "On Campus" : "Off Campus"} />
          {state.neighborhood ? (
            <ReviewRow label="Neighborhood" value={state.neighborhood} />
          ) : null}
          <ReviewRow label="Price" value={state.isFree ? "Free" : `$${state.priceMonthly}/mo`} />
          {state.restrictions ? (
            <ReviewRow label="Restrictions" value={state.restrictions} />
          ) : null}
        </>
      )}

      {state.type === "housing" && (
        <>
          <ReviewRow label="Side" value={state.side === "offering" ? "Offering" : "Looking"} />
          <ReviewRow label="Monthly Rent" value={`$${state.monthlyRent}/mo`} />
          {state.housingSubtype === "sublet" && (
            <>
              <ReviewRow label="Move-in" value={state.moveInDate} />
              <ReviewRow label="Move-out" value={state.moveOutDate} />
            </>
          )}
          {state.housingSubtype === "passdown" && (
            <>
              <ReviewRow label="Lease Start" value={state.leaseStartDate} />
              <ReviewRow label="Lease Duration" value={durationLabel} />
            </>
          )}
          <ReviewRow label="Bedrooms" value={bedroomsLabel} />
          <ReviewRow label="Bathrooms" value={bathroomsLabel} />
          {state.neighborhood ? (
            <ReviewRow label="Neighborhood" value={state.neighborhood} />
          ) : null}
          {state.amenities.length > 0 && (
            <ReviewRow
              label="Amenities"
              value={state.amenities
                .map(
                  (a) =>
                    HOUSING_AMENITIES.find((h) => h.value === a)?.label || a
                )
                .join(", ")}
            />
          )}
          <ReviewRow
            label="Roommates"
            value={
              state.roommates === "solo"
                ? "Solo"
                : state.roommateCount
                  ? `${state.roommateCount} roommate${state.roommateCount !== "1" ? "s" : ""}`
                  : "Shared"
            }
          />
        </>
      )}
    </View>
  );
}

/* ────────────────────────────────────────────────────
 * Main screen
 * ──────────────────────────────────────────────────── */

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { state, update, goToStep, nextStep, prevStep, canAdvance, submit } =
    useCreatePost();

  if (authLoading) {
    return (
      <View style={styles.authGate}>
        <ActivityIndicator size="large" color={colors.maroon[600]} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={[styles.authGate, { paddingTop: insets.top }]}>
        <FontAwesome name="lock" size={40} color={colors.gray[300]} />
        <Text style={styles.authGateTitle}>Sign in to create a post</Text>
        <Text style={styles.authGateSubtitle}>
          You need to be signed in with your UChicago account to create posts.
        </Text>
        <Pressable
          style={styles.authGateButton}
          onPress={() => router.push("/(tabs)/profile" as never)}
        >
          <Text style={styles.authGateButtonText}>Go to Profile</Text>
        </Pressable>
      </View>
    );
  }

  const accent = state.type ? getAccentColor(state.type) : colors.maroon[600];

  async function handlePublish() {
    const postId = await submit();
    if (postId) {
      Alert.alert("Post Published!", "Your post is now live.", [
        { text: "View Post", onPress: () => router.push(`/posts/${postId}` as never) },
        { text: "OK" },
      ]);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Text style={styles.screenTitle}>Create Post</Text>

      <StepIndicator
        steps={STEPS}
        currentStep={state.step}
        onStepPress={goToStep}
      />

      {/* Error banner */}
      {state.error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{state.error}</Text>
        </View>
      )}

      {/* Step content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {state.step === 1 && <StepPhotos state={state} update={update} />}
        {state.step === 2 && <StepType state={state} update={update} />}
        {state.step === 3 && <StepBasicInfo state={state} update={update} />}
        {state.step === 4 && <StepTypeDetails state={state} update={update} />}
        {state.step === 5 && <StepReview state={state} />}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {state.step === 1 && (
          <View style={styles.footerRow}>
            {state.images.length === 0 && (
              <Pressable onPress={nextStep}>
                <Text style={styles.skipText}>Skip for now</Text>
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            <Pressable
              style={[styles.nextBtn, { backgroundColor: accent }]}
              onPress={nextStep}
            >
              <Text style={styles.nextBtnText}>Next</Text>
            </Pressable>
          </View>
        )}

        {state.step >= 2 && state.step <= 4 && (
          <View style={styles.footerRow}>
            <Pressable style={styles.backBtn} onPress={prevStep}>
              <Text style={styles.backBtnText}>Back</Text>
            </Pressable>
            <Pressable
              style={[
                styles.nextBtn,
                { backgroundColor: accent },
                !canAdvance() && styles.disabledBtn,
              ]}
              onPress={nextStep}
              disabled={!canAdvance()}
            >
              <Text style={styles.nextBtnText}>Next</Text>
            </Pressable>
          </View>
        )}

        {state.step === 5 && (
          <View style={styles.footerRow}>
            <Pressable style={styles.backBtn} onPress={prevStep}>
              <Text style={styles.backBtnText}>Back</Text>
            </Pressable>
            <Pressable
              style={[
                styles.nextBtn,
                { backgroundColor: accent },
                state.isSubmitting && styles.disabledBtn,
              ]}
              onPress={handlePublish}
              disabled={state.isSubmitting}
            >
              {state.isSubmitting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.nextBtnText}>Publish Post</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

/* ────────────────────────────────────────────────────
 * Styles
 * ──────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.gray[900],
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  errorBanner: {
    marginHorizontal: 16,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  stepContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.gray[900],
  },
  stepSubtitle: {
    fontSize: 14,
    color: colors.gray[500],
    marginTop: -8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.gray[900],
    backgroundColor: colors.gray[50],
  },
  textArea: {
    minHeight: 90,
  },
  charCounter: {
    fontSize: 11,
    color: colors.gray[400],
    textAlign: "right",
    marginTop: 4,
  },

  /* Footer */
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
    backgroundColor: colors.white,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.gray[200],
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.gray[600],
  },
  nextBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.white,
  },
  disabledBtn: {
    opacity: 0.4,
  },
  skipText: {
    fontSize: 14,
    color: colors.gray[500],
    textDecorationLine: "underline",
  },

  /* Auth gate */
  authGate: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: colors.white,
    gap: 12,
  },
  authGateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.gray[900],
    marginTop: 8,
  },
  authGateSubtitle: {
    fontSize: 13,
    color: colors.gray[500],
    textAlign: "center",
    lineHeight: 18,
  },
  authGateButton: {
    marginTop: 8,
    backgroundColor: colors.maroon[600],
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  authGateButtonText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 14,
  },
});
